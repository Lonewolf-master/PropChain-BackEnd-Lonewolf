export function logEmailEvent(emailId: string, event: string, correlationId?: string) {
  console.log(JSON.stringify({
    level: 'info',
    type: 'email',
    emailId,
    event,
    correlationId,
    timestamp: new Date().toISOString(),
  }));
}
