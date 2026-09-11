import { expect, test } from '@playwright/test';

/**
 * The path a new user actually walks: create a profile, get the starter
 * routine, look at an exercise, and check the privacy screen says what the
 * README promises.
 */
test.describe('first run', () => {
  test('creates a profile and a routine', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('./');
    await expect(
      page.getByRole('heading', { name: /crea un perfil|create a profile/i }),
    ).toBeVisible();

    await page.getByRole('link', { name: /añadir persona|add a person/i }).click();
    await page.getByLabel(/nombre|name/i).fill('Ana');
    await page.getByRole('button', { name: /guardar|save/i }).click();
    await expect(page.getByText('Ana')).toBeVisible();

    await page.getByRole('link', { name: /inicio|home/i }).click();
    await page.getByRole('button', { name: /crear una rutina|create a routine/i }).click();

    // The starter routine is the maker's own back routine.
    await expect(page.getByText(/puente de glúteos|glute bridge/i)).toBeVisible();
    await expect(page.getByText(/plancha frontal|front plank/i)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('shows the exercise library with animated demos', async ({ page }) => {
    await page.goto('library');
    await expect(page.getByRole('heading', { name: /ejercicios|exercises/i })).toBeVisible();
    await expect(page.getByText(/rangos por defecto|default ranges/i)).toBeVisible();
    await expect(page.getByRole('img', { name: /esqueleto|skeleton/i }).first()).toBeVisible();

    await page
      .getByText(/puente de glúteos|glute bridge/i)
      .first()
      .click();
    await expect(page.getByText(/dónde poner la cámara|where to put the camera/i)).toBeVisible();
    await expect(page.getByText(/165–185°/)).toBeVisible();
  });

  test('states the privacy promise', async ({ page }) => {
    await page.goto('settings/privacy');
    await expect(page.getByText(/sin vídeo|no video/i)).toBeVisible();
    await expect(page.getByText(/no es un producto sanitario|not a medical device/i)).toBeVisible();
  });
});

/**
 * The specification's first acceptance criterion for the session: the camera
 * setup assistant blocks the session until the landmarks it needs are stable.
 *
 * The camera is stubbed with an empty canvas stream, so the pose model sees no
 * body and the assistant must never let the session start. Stubbing keeps the
 * test independent of whether the machine running it owns a camera.
 */
test('the setup assistant blocks the session when it cannot see a body', async ({ page }) => {
  // The pose model is fetched from a path built against the app's base, which
  // is what breaks first when the app moves into a subdirectory.
  const modelResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.task')) {
      modelResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#404040';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const stream = canvas.captureStream(30);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'stub', label: 'stub' }],
      },
    });
  });

  await page.goto('profiles');
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await page.getByRole('button', { name: /guardar|save/i }).click();
  await page.getByRole('link', { name: /inicio|home/i }).click();
  await page.getByRole('button', { name: /crear una rutina|create a routine/i }).click();
  // The starter routine opens in the builder; go back to the routine list.
  await page.getByRole('button', { name: /atrás|back/i }).click();

  await page
    .getByRole('link', { name: /empezar|start/i })
    .first()
    .click();
  await page.getByRole('button', { name: /empezar|start/i }).click();

  // The checks appear and the counter never does.
  await expect(page.getByText(/se te ve entero|whole body is visible/i)).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForTimeout(4000);
  await expect(page.getByText(/quieto dos segundos|hold still/i)).toBeVisible();
  await expect(page.getByText(/de 12|of 12/)).toHaveCount(0);

  // The model was actually served: a 404 here would mean the base path is wrong.
  expect(modelResponses.length).toBeGreaterThan(0);
  for (const response of modelResponses) {
    expect(response.status, `${response.url} was not served`).toBe(200);
  }
});

/**
 * Voice commands need WebGPU and a microphone. On a machine without them the
 * setting must say so and stay off rather than offering something that cannot
 * work — this test runs on exactly such a machine in CI.
 */
test('offers voice commands, or says why it cannot', async ({ page }) => {
  await page.goto('settings');
  await expect(
    page.getByRole('heading', { name: /comandos de voz|voice commands/i }),
  ).toBeVisible();

  const toggle = page.getByLabel(/controlar la sesión hablando|run the session by talking/i);
  await expect(toggle).not.toBeChecked();
  if (await toggle.isDisabled()) {
    await expect(
      page.getByText(/no puede escuchar comandos|cannot listen for commands/i),
    ).toBeVisible();
    return;
  }
  // The setting is written to the database before the store updates, so the
  // checkbox catches up a tick after the click rather than during it.
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByText(/«pausa»|«pause»/)).toBeVisible();
});
