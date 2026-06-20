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
	return `<b>${title}</b>\n<blockquote>${safeContent || 'No output data'}</blockquote>\n`;
};

export const getProgressBar = (step: number, total: number): string => {
	const filled = Math.round((step / total) * 10);
	const filledChars = '🟩'.repeat(filled);
	const emptyChars = '⬜'.repeat(10 - filled);
	return `${filledChars}${emptyChars} ${Math.round((step / total) * 100)}%`;
};
