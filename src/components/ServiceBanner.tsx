export function ServiceBanner() {
  return (
    <p
      id="service-paused-banner"
      role="alert"
      className="mb-4 w-full min-w-0 break-words rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-center text-sm text-warning"
    >
      用戶擁擠，系統暫停服務，請稍後再試
    </p>
  );
}
