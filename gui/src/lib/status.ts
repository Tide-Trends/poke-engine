import { checkEngine, type StatusSnapshot } from './engine';

export function createStatusPoller(baseUrl: () => string, onUpdate: (snapshot: StatusSnapshot) => void) {
  let timer: number | undefined;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      onUpdate(await checkEngine(baseUrl()));
    } catch (error) {
      onUpdate({
        online: false,
        message: error instanceof Error ? error.message : 'Unable to reach engine',
        checkedAt: new Date().toISOString(),
        endpoints: [],
      });
    }
  };

  void tick();
  timer = window.setInterval(() => void tick(), 5000);

  return () => {
    stopped = true;
    if (timer) window.clearInterval(timer);
  };
}
