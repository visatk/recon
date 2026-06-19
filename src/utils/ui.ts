export const escapeHtml = (unsafe: string): string => {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const formatOutput = (title: string, content: string): string => {
    const safeContent = escapeHtml(content.trim());
    return `<b>${title}</b>\n<pre>${safeContent || 'No output data'}</pre>\n`;
};

export const getProgressBar = (step: number, total: number): string => {
    const filled = '█'.repeat(step);
    const empty = '░'.repeat(total - step);
    return `[${filled}${empty}] ${Math.round((step / total) * 100)}%`;
};
