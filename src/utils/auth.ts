export async function verifyTelegramWebAppData(initData: string, botToken: string): Promise<any | null> {
	try {
		const urlParams = new URLSearchParams(initData);
		const hash = urlParams.get('hash');
		if (!hash) return null;

		urlParams.delete('hash');
		urlParams.sort();

		let dataCheckString = '';
		for (const [key, value] of urlParams.entries()) {
			dataCheckString += `${key}=${value}\n`;
		}
		dataCheckString = dataCheckString.slice(0, -1);

		const encoder = new TextEncoder();
		const secretKey = await crypto.subtle.importKey(
			'raw',
			await crypto.subtle.sign(
				'HMAC',
				await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
				encoder.encode(botToken)
			),
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);

		const signature = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(dataCheckString));
		const hexSignature = Array.from(new Uint8Array(signature))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');

		if (hexSignature === hash) {
			const userJson = urlParams.get('user');
			return userJson ? JSON.parse(userJson) : null;
		}
		return null;
	} catch (error) {
		console.error('Auth Error:', error);
		return null;
	}
}
