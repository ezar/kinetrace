import { expect, test } from '@playwright/test';

/**
 * The path a new user actually walks: the first run, out of it with a profile
 * and a routine, then the library and the privacy promise the README makes.
 */
test.describe('first run', () => {
  test('walks somebody from nothing to a routine', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    // Anybody who has never been here is sent to the first run.
    await page.goto('./');
    await expect(page).toHaveURL(/welcome/);
    await expect(
      page.getByRole('heading', { name: /un entrenador que te ve|a coach that can see you/i }),
    ).toBeVisible();

    const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
    await next.click();
    await expect(page.getByText(/sin vídeo|no video/i)).toBeVisible();
    await next.click();

    // The profile is the one step that cannot be walked past empty.
    await expect(next).toBeDisabled();
    await page.getByLabel(/nombre|name/i).fill('Ana');
    await expect(next).toBeEnabled();
    await next.click();

    // The example routine is the default choice.
    await expect(page.getByText(/rutina de ejemplo|example routine/i).first()).toBeVisible();
    await next.click();

    // The gestures are shown being performed, not described.
    await expect(page.getByText(/levanta las dos manos|both hands up/i)).toBeVisible();
    await expect(page.getByRole('img', { name: /esqueleto|skeleton/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /^empezar$|^start$/i }).click();

    // Out on the home screen, with the starter routine ready to run.
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$|\/kinetrace\/$/);
    await expect(page.getByText('Ana')).toBeVisible();
    await expect(page.getByRole('link', { name: /empezar|start/i }).first()).toBeVisible();

    // And never again, however many times the app is opened.
    await page.goto('./');
    await expect(page).not.toHaveURL(/welcome/);
    expect(errors).toEqual([]);
  });

  test('lets somebody skip the first run', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(/welcome/);
    await page.getByRole('button', { name: /saltar|skip/i }).click();
    await expect(page).not.toHaveURL(/welcome/);
    await expect(
      page.getByRole('heading', { name: /crea un perfil|create a profile/i }),
    ).toBeVisible();
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

/**
 * The professional review. The numbers the library ships are defaults, and this
 * is where somebody qualified replaces them — including the check that knows
 * how the engine counts and will not let a target be signed that the engine
 * could never judge against.
 */
test('lets a professional review the exercises and sign', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Through the first run to get a profile and the starter routine.
  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  await page.getByRole('link', { name: /editar|edit/i }).click();
  await expect(page.getByText(/rangos por defecto|default ranges/i)).toBeVisible();
  await page.getByRole('button', { name: /revisar los ejercicios|review the exercises/i }).click();

  const sign = page.getByRole('button', { name: /^firmar$|^sign$/i });
  const signature = page.getByLabel(/firma|signature/i);
  const bridge = page
    .locator('section')
    .filter({ hasText: /puente de glúteos|glute bridge/i })
    .first();

  // The library's own numbers raise nothing, and can be signed.
  await signature.fill('Dra. Ruiz');
  await expect(sign).toBeEnabled();

  // A target below the point a repetition is counted at is only a warning: the
  // professional is the authority, the app just makes sure they can see it.
  await bridge.getByLabel(/objetivo desde|target from/i).fill('140');
  await expect(bridge.getByText(/148/)).toBeVisible();
  await expect(sign).toBeEnabled();

  // A target nobody could reach is an error, and blocks the signature.
  await bridge.getByLabel(/objetivo desde|target from/i).fill('200');
  await expect(page.getByText(/marcado en rojo|marked in red/i)).toBeVisible();
  await expect(sign).toBeDisabled();

  await bridge.getByLabel(/objetivo desde|target from/i).fill('170');
  await expect(sign).toBeEnabled();
  await sign.click();

  // Signed, and the routine says so from here on.
  await expect(page).toHaveURL(/routines\/\d+$/);
  await expect(page.getByText(/dra\. ruiz/i)).toBeVisible();
  expect(errors).toEqual([]);
});

/**
 * Help. Most of it is generated from the library and the engine, so the test
 * checks the generated parts are there rather than the prose: the gestures
 * drawn, the real voice vocabulary, and the way back into the introduction.
 */
test('has a help screen that can reopen the introduction', async ({ page }) => {
  await page.goto('help');
  await expect(page.getByRole('heading', { name: /^ayuda$|^help$/i })).toBeVisible();

  // The gestures are performed by the same figure the session draws.
  await expect(page.getByRole('img', { name: /esqueleto|skeleton/i })).toHaveCount(2);
  await expect(page.getByText(/levanta las dos manos|both hands up/i)).toBeVisible();

  // The vocabulary comes from the matcher's own table, accents and all.
  await expect(page.getByText('«siguiente ejercicio»', { exact: false })).toBeVisible();
  await expect(page.getByText('«fin de la sesión»', { exact: false })).toBeVisible();

  // Every camera placement the library uses, told apart by position and view.
  await expect(page.getByText(/móvil en una silla, a 3 m, de frente a ti/i)).toBeVisible();

  await page.getByRole('link', { name: /verla otra vez|watch it again/i }).click();
  await expect(page).toHaveURL(/welcome/);
});

/**
 * The page that gets handed across a desk. It reports and does not conclude, so
 * the test checks the numbers are the ones stored and that nothing is phrased in
 * a way a clinician would misread.
 */
test('prints a sheet for the physiotherapist', async ({ page }) => {
  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  // Two finished sessions: one counted exercise and one isometric.
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('kinetrace');
      request.onsuccess = () => resolve(request.result);
    });
    const add = (store: string, value: unknown): Promise<IDBValidKey> =>
      new Promise((resolve) => {
        const request = database.transaction(store, 'readwrite').objectStore(store).add(value);
        request.onsuccess = () => resolve(request.result);
      });
    for (let index = 0; index < 2; index += 1) {
      const startedAt = Date.now() - (index + 1) * 86_400_000;
      const sessionId = await add('sessions', {
        profileId: 1,
        routineId: 1,
        startedAt,
        endedAt: startedAt + 600_000,
        painScore: 3,
        notes: 'Sin molestias',
      });
      await add('sets', {
        sessionId,
        exerciseId: 'glute-bridge',
        index: 0,
        reps: 12,
        partials: 0,
        holdMs: 0,
        romMax: 170,
        romMean: 165,
        goodRepPct: 100,
        issues: {},
        peaks: [],
        startedAt,
      });
      await add('sets', {
        sessionId,
        exerciseId: 'front-plank',
        index: 1,
        reps: 0,
        partials: 0,
        holdMs: 30_000,
        romMax: 0,
        romMean: 0,
        goodRepPct: 100,
        issues: {},
        peaks: [],
        startedAt,
      });
    }
  });

  await page.goto('report');
  await expect(page.getByRole('heading', { name: /kinetrace · ana/i })).toBeVisible();

  // Sets and repetitions are two facts: "2 × 24" would read as 24 reps per set.
  await expect(page.getByText(/2 series · 24 rep|2 sets · 24 reps/i)).toBeVisible();

  // A hold has no range to report, and is not given a fake 0°.
  await expect(page.getByText(/sin rango|no range/i)).toBeVisible();

  // What the person wrote about themselves, shown and not summarised.
  await expect(page.getByText('Sin molestias').first()).toBeVisible();

  // The table fits a phone rather than scrolling the target out of sight.
  const table = await page.locator('table').boundingBox();
  expect(table?.width ?? 0).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});
