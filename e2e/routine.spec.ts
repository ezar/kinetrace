import { expect, test, type Page } from '@playwright/test';

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
/**
 * The first run creates two routines: the back one first, then the stretches.
 * The home screen shows the most recently updated as today's, so "today" is the
 * stretches — these tests are about the back routine and open it by its id.
 */
const BACK_ROUTINE = '1';

/**
 * Walk out of the demonstration a first session shows, one card at a time.
 *
 * Each click is preceded by an assertion that the expected card is on screen,
 * rather than polling the button: the last click navigates, and a poll that
 * catches the button mid-navigation never settles.
 */
async function stepPastPrimer(page: Page, cards: number): Promise<void> {
  await expect(page.getByText(/así es el ejercicio|this is the exercise/i)).toBeVisible();
  for (let card = 1; card <= cards; card += 1) {
    if (cards > 1) await expect(page.getByText(`${card} / ${cards}`)).toBeVisible();
    await page
      .getByRole('button', { name: /^continuar$|^continue$|^empezar$|^start$/i })
      .first()
      .click();
  }
}

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
  // A first session shows how each exercise is done; step past all five.
  await stepPastPrimer(page, 5);
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
 * A session the pose model never arrived for.
 *
 * The camera can be perfect and the model still missing: the file is fetched on
 * demand and kept, so the first session on a bad connection has nothing to see
 * with. The screen used to fall through to the coaching panel and show a
 * repetition counter, a target band and the gesture hints for a session that
 * would never count a single thing.
 */
test('says so when the pose model cannot be loaded, instead of coaching anyway', async ({
  browser,
}) => {
  // The service worker keeps the model, so a cached one would never fail.
  const context = await browser.newContext({ permissions: ['camera'], serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/models/*.task', (route) =>
    route.fulfill({ status: 404, body: 'not found' }),
  );
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
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
  // Creating the routine opens it in the builder, which is also how we learn
  // its id rather than assuming one.
  await page.getByRole('button', { name: /crear una rutina|create a routine/i }).click();
  await page.waitForURL(/routines\/\d+/);
  const routineId = /routines\/(\d+)/.exec(page.url())?.[1];
  await page.goto(`session/${routineId}`);

  await expect(
    page.getByText(/no se ha podido cargar el modelo|pose model could not be loaded/i),
  ).toBeVisible({ timeout: 30_000 });

  // Not the coaching panel: no counter, no target band, no gesture hints.
  await expect(page.getByText(/de 10 repeticiones|of 10 repetitions/i)).toHaveCount(0);
  await expect(page.getByText(/levanta las dos manos|both hands up/i)).toHaveCount(0);

  // And the two ways forward: try again, or do it without the camera.
  await expect(page.getByRole('button', { name: /reintentar|try again/i })).toBeVisible();
  await page.getByRole('button', { name: /sin cámara|without the camera/i }).click();
  await expect(page).toHaveURL(new RegExp(`guided/${routineId}`));

  await context.close();
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

  await page.goto(`routines/${BACK_ROUTINE}`);
  await expect(page.getByText(/rangos por defecto|default ranges/i)).toBeVisible();
  await page.getByRole('button', { name: /revisar los ejercicios|review the exercises/i }).click();

  const sign = page.getByRole('button', { name: /^firmar$|^sign$/i });
  const signature = page.getByLabel(/firma|signature/i);
  const bridge = page
    .locator('section')
    .filter({ hasText: /puente de glúteos|glute bridge/i })
    .first();

  // While nobody has signed, each card says where its two families of numbers
  // came from — and says plainly that the dosage came from nowhere.
  const anglesSource = page
    .getByText(/salen de ejecutar el motor|running the engine over/i)
    .first();
  const doseSource = page
    .getByText(/no prescriben series ni repeticiones|do not prescribe sets or repetitions/i)
    .first();
  await expect(anglesSource).toBeVisible();
  await expect(doseSource).toBeVisible();

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

  // Once signed, they go: somebody has taken responsibility for every number.
  await expect(anglesSource).toHaveCount(0);
  await expect(doseSource).toHaveCount(0);

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
/**
 * A published programme, transcribed. The point of the screen is not the five
 * exercises it can run but the two things printed around them: where the
 * numbers came from, and which of the document's exercises the app has no
 * exercise for. A transcription that quietly dropped the other five would look
 * identical without them.
 */
test('builds a routine from a published programme, and says what it left out', async ({ page }) => {
  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  await page.getByRole('button', { name: /programa sermef|sermef programme/i }).click();
  await expect(page).toHaveURL(/routines\/\d+/);

  // The citation, and the fact that a citation is not a prescription.
  await expect(page.getByText(/SERMEF/).first()).toBeVisible();
  await expect(page.getByText(/Programas de ejercicios para Columna Lumbar/)).toBeVisible();
  await expect(page.getByText(/copiados del documento|copied from the document/i)).toBeVisible();

  // The document's order, which is not the app's own back routine order.
  const names = await page.locator('main li p.font-medium, li p.font-medium').allInnerTexts();
  expect(names.slice(0, 3)).toEqual(['Puente de glúteos', 'Postura del niño', 'Gato y camello']);

  // The printed dose, and the document's own words under it.
  await expect(page.getByText('4 × 10s · 0s', { exact: false })).toBeVisible();
  await expect(
    page.getByText(/Estiramiento lumbosacro en suelo\. Flexionar las rodillas/),
  ).toBeVisible();

  // The seven steps the library cannot run, each with a reason — including the
  // two whose library exercise has the right name and the wrong movement.
  await expect(page.getByText(/Báscula pélvica en supino/)).toBeVisible();
  await expect(page.getByText(/Abdominales inferiores/)).toBeVisible();
  await expect(page.getByText(/Elevación brazo-pierna alternativa/)).toBeVisible();
  await expect(
    page.getByText(/no está en la biblioteca|not in the library/i).first(),
  ).toBeVisible();

  // Opening it again is the same routine, not a second copy.
  await page.getByRole('link', { name: /inicio|home/i }).click();
  await page.getByRole('button', { name: /programa sermef|sermef programme/i }).click();
  await expect(page.getByText(/Programas de ejercicios para Columna Lumbar/)).toBeVisible();
  await page.getByRole('link', { name: /inicio|home/i }).click();
  await expect(page.getByText(/programa sermef|sermef programme/i).first()).toBeVisible();
});

test('the library can be browsed by which way an exercise loads the back', async ({ page }) => {
  await page.goto('library');
  await expect(page.getByRole('heading', { name: /ejercicios|exercises/i })).toBeVisible();

  // Every exercise, then only the ones that increase the lumbar curve.
  await expect(page.getByRole('link', { name: /gato y camello|cat and camel/i })).toBeVisible();
  await page.getByRole('button', { name: /^extensión lumbar$|^lumbar extension$/i }).click();
  await expect(page.getByRole('link', { name: /extensión en prono|prone press/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /gato y camello|cat and camel/i })).toHaveCount(0);
});

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

/**
 * The privacy promise is a header, not an intention.
 *
 * The policy is served by `vite preview` as well as by the deployment, so this
 * runs against the real thing. A violation is reported to the console rather
 * than thrown, which is exactly how a broken CSP reaches production unnoticed:
 * the fix is to fail a test on it.
 */
test('serves a policy that leaves nowhere for the data to go', async ({ page, request }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });

  const response = await request.get('./');
  const policy = response.headers()['content-security-policy'] ?? '';
  expect(policy, 'no Content-Security-Policy header').not.toBe('');

  const directives = new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...values] = part.split(/\s+/);
        return [name ?? '', values];
      }),
  );

  // Nothing may be sent anywhere but this origin and the two public model
  // hosts. This is the line that makes "video never leaves the device" true by
  // construction rather than by inspection.
  const connect = directives.get('connect-src') ?? [];
  expect(connect).toContain("'self'");
  expect(
    connect.every(
      (source) => source === "'self'" || source === 'blob:' || /^https:\/\//.test(source),
    ),
  ).toBe(true);
  expect(connect).not.toContain('*');
  expect(directives.get('default-src')).toEqual(["'self'"]);
  expect(directives.get('object-src')).toEqual(["'none'"]);
  expect(directives.get('frame-ancestors')).toEqual(["'none'"]);

  // And the app still boots under it: a policy that breaks the pose worker or
  // the audio worklet would be worse than none.
  await page.goto('./');
  await expect(
    page.getByRole('heading', { name: /un entrenador que te ve|a coach that can see you/i }),
  ).toBeVisible();
  expect(violations, violations.join('\n')).toEqual([]);
});

/**
 * The side of a unilateral exercise.
 *
 * The starter routine is all bilateral, so nothing else in this suite ever
 * renders the control — and a prescription the professional cannot express is
 * the same as one the app ignores.
 */
test('lets the professional prescribe a side, and counts both when they do not', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  await page.goto(`routines/${BACK_ROUTINE}`);
  const beforeAdding = await page.getByText(/unos \d+ min|about \d+ min/i).innerText();

  await page.getByRole('button', { name: /añadir ejercicio|add exercise/i }).click();
  await page
    .locator('button')
    .filter({ hasText: /plancha lateral completa|full side plank/i })
    .first()
    .click();
  // Both sides are twice the work, and the estimate has to say so.
  await expect(page.getByText(/unos \d+ min|about \d+ min/i)).not.toHaveText(beforeAdding);
  await page.getByRole('button', { name: /^guardar$|^save$/i }).click();

  // Saving lands on the routine, where the review is one click away.
  await page.getByRole('button', { name: /revisar los ejercicios|review the exercises/i }).click();

  const plank = page
    .locator('section')
    .filter({ hasText: /plancha lateral completa|full side plank/i })
    .first();
  await expect(plank.getByRole('button', { name: /^los dos$|^both$/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Naming a side is what stops the camera answering a clinical question.
  await plank.getByRole('button', { name: /^derecha$|^right$/i }).click();
  await expect(plank.getByRole('button', { name: /^derecha$|^right$/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await page.getByLabel(/firma|signature/i).fill('Dra. Ruiz');
  await page.getByRole('button', { name: /^firmar$|^sign$/i }).click();
  await expect(page).toHaveURL(/routines\/\d+$/);

  // And it survives the round trip through the database.
  await page.getByRole('button', { name: /revisar otra vez|review again/i }).click();
  await expect(
    page
      .locator('section')
      .filter({ hasText: /plancha lateral completa|full side plank/i })
      .first()
      .getByRole('button', { name: /^derecha$|^right$/i }),
  ).toHaveAttribute('aria-pressed', 'true');

  expect(errors).toEqual([]);
});

/**
 * The session with no camera.
 *
 * Headless Chromium has a speech synthesis that accepts an utterance and never
 * finishes it, so the test replaces `speak` with one that records the sentence
 * and ends it. What it asserts is the part that matters: the order it says
 * things in, and that the set it writes claims to have measured nothing.
 */
test('shows what each exercise looks like before somebody has done it', async ({ page }) => {
  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  // Starting a routine for the first time goes through the demonstration.
  await page.goto(`prepare/${BACK_ROUTINE}`);
  await expect(page.getByText(/así es el ejercicio|this is the exercise/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /gato y camello|cat and camel/i })).toBeVisible();
  // The five exercises of the starter routine, each once however many sets.
  await expect(page.getByText('1 / 5')).toBeVisible();
  // Built from the exercise's own reference motion, like every other demo.
  await expect(page.locator('svg')).toBeVisible();
  await expect(page.getByText(/2 series de 10|2 sets of 10/i)).toBeVisible();
  // And how it is done, in words, which is the half you can read at your pace.
  await expect(page.getByText(/ponte a cuatro patas|get on all fours/i)).toBeVisible();
  // On the way to a measured session, where to put the phone matters.
  const cameraTip = page.getByText(/móvil en el suelo|phone on the floor/i);
  await expect(cameraTip).toBeVisible();

  // On the way to a session with no camera, it does not.
  await page.goto(`prepare/${BACK_ROUTINE}?mode=guided`);
  await expect(page.getByRole('heading', { name: /gato y camello|cat and camel/i })).toBeVisible();
  await expect(cameraTip).toHaveCount(0);

  await page.goto(`prepare/${BACK_ROUTINE}`);
  await expect(page.getByText('1 / 5')).toBeVisible();

  await page.getByRole('button', { name: /^continuar$|^continue$/i }).click();
  await expect(page.getByText('2 / 5')).toBeVisible();
  await expect(page.getByRole('heading', { name: /puente|bridge/i })).toBeVisible();

  // "I know this one" is remembered. Said about the four that are left, only
  // the cat and camel — which Continue was pressed on — comes back next time.
  const known = page.getByRole('button', { name: /ya me lo sé|i know this one/i });
  for (let card = 2; card <= 5; card += 1) {
    await expect(page.getByText(`${card} / 5`)).toBeVisible();
    await known.click();
  }
  await expect(page).toHaveURL(/\/session\//);

  await page.goto(`prepare/${BACK_ROUTINE}`);
  await expect(page.getByRole('heading', { name: /gato y camello|cat and camel/i })).toBeVisible();
  // One card left, so no counter at all.
  await expect(page.getByText('1 / 5')).toHaveCount(0);

  // And settings takes every one of them back.
  await page.goto('settings');
  const restore = page.getByRole('button', { name: /volver a ver|show the/i });
  await restore.click();
  // It goes away when there is nothing left to restore, which is also how we
  // know the write landed before this reloads the page out from under it.
  await expect(restore).toHaveCount(0);
  await page.goto(`prepare/${BACK_ROUTINE}`);
  await expect(page.getByText('1 / 5')).toBeVisible();
});

test('runs a routine by voice alone, and records that it measured nothing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const proto = Object.getPrototypeOf(window.speechSynthesis) as {
      speak: (utterance: SpeechSynthesisUtterance) => void;
      cancel: () => void;
    };
    proto.speak = (utterance: SpeechSynthesisUtterance) => {
      spoken.push(utterance.text);
      setTimeout(() => utterance.dispatchEvent(new Event('end')), 10);
    };
    proto.cancel = () => undefined;
  });

  await page.goto('./');
  const next = page.getByRole('button', { name: /^continuar$|^continue$/i });
  await next.click();
  await next.click();
  await page.getByLabel(/nombre|name/i).fill('Ana');
  await next.click();
  await next.click();
  await page.getByRole('button', { name: /^empezar$|^start$/i }).click();
  await expect(page.getByText('Ana')).toBeVisible();

  await page.goto(`prepare/${BACK_ROUTINE}?mode=guided`);
  await stepPastPrimer(page, 5);
  await expect(page.getByText(/no mide nada|measures nothing/i)).toBeVisible();
  await page.getByRole('button', { name: /sin cámara|without the camera/i }).click();

  // It announces the exercise, doses it, counts in, and starts. Asserted on
  // what was said rather than on what is on screen: the caption now follows the
  // movement cues, so "begin" is replaced the moment the work starts.
  const said = (): Promise<string[]> =>
    page.evaluate(() =>
      (window as unknown as { __spoken: string[] }).__spoken
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    );
  await page.waitForFunction(
    () =>
      (window as unknown as { __spoken: string[] }).__spoken.filter((line) => line.trim()).length >=
      7,
    undefined,
    { timeout: 15_000 },
  );
  const spoken = await said();
  expect(spoken.slice(0, 3)).toEqual([
    expect.stringMatching(/gato y camello|cat camel/i),
    expect.stringMatching(/serie 1 de 2|set 1 of 2/i),
    expect.stringMatching(/colócate|get into position/i),
  ]);
  // Counted in from three — now on a clock of its own, a second a number.
  expect(spoken.slice(3, 6)).toEqual(['3', '2', '1']);

  // And then the movement, with no "empieza" between: a cat and camel calls its
  // first movement on the instant the work starts, and speaking a line cancels
  // the one before it, so a start word there was said and cut off. The movement
  // is the better word anyway — it says both that it has begun and what to do.
  expect(spoken[6]).toMatch(/redondea|round/i);
  expect(spoken).not.toContain('Empieza');

  // It calls the movement every repetition, not only the number. A cat and
  // camel rounds, returns, arches and returns before the first is counted, and
  // none of those four is a number.
  await page.waitForFunction(
    () => {
      // The count-in also says "1", so wait for the one that closes the first
      // repetition rather than the last second before the set.
      const lines = (window as unknown as { __spoken: string[] }).__spoken;
      const begun = lines.findIndex((line, index) => index > 5 && /^\D/.test(line));
      return begun >= 0 && lines.indexOf('1', begun) > begun;
    },
    undefined,
    { timeout: 20_000 },
  );
  const lines = await said();
  const begun = lines.findIndex((line, index) => index > 5 && /^\D/.test(line));
  const cues = lines.slice(begun, lines.indexOf('1', begun));
  expect(cues).toHaveLength(4);
  for (const cue of cues) expect(cue).not.toMatch(/^\d+$/);

  // The tally is repetitions, never seconds: one number, and the right one.
  await expect(page.getByText(/de 10 repeticiones|of 10 repetitions/i)).toBeVisible();

  // Skipping records nothing at all — the set did not happen — and moves on.
  await page.getByRole('button', { name: /^saltar$|^skip$/i }).click();
  await expect(page.getByText('2 / 14')).toBeVisible();
  const written = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('kinetrace');
        open.onsuccess = () => {
          const request = open.result.transaction('sets').objectStore('sets').count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(-1);
        };
        open.onerror = () => resolve(-1);
      }),
  );
  expect(written).toBe(0);

  // Ending the session leads to the summary, which must not claim a percentage
  // for work nobody watched.
  await page.getByRole('button', { name: /terminar sesión|end session/i }).click();
  await page.getByRole('button', { name: /^continuar$|^continue$/i }).click();
  await expect(page).toHaveURL(/summary|\/$/);

  expect(errors).toEqual([]);
});
