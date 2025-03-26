export function formatIST(ts: number): string {
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour12: true,
    }).format(new Date(ts));
}
