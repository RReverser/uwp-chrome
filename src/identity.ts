import { runtime, wrapAsync } from './runtime';

const { WebAuthenticationBroker, WebAuthenticationOptions, WebAuthenticationStatus } = Windows.Security.Authentication.Web;
const { HttpStatusCode, HttpClient, HttpFormUrlEncodedContent } = Windows.Web.Http;
const { Uri } = Windows.Foundation;
const { StringMap } = Windows.Foundation.Collections;

type Uri = Windows.Foundation.Uri;

async function authenticate(interactive: boolean, start: Uri, end: Uri) {
	let result = await WebAuthenticationBroker.authenticateAsync(
		interactive ? WebAuthenticationOptions.none : WebAuthenticationOptions.silentMode,
		start,
		end
	);
	switch (result.responseStatus) {
		case WebAuthenticationStatus.success: {
			return result.responseData;
		}

		case WebAuthenticationStatus.errorHttp: {
			let code = result.responseErrorDetail;
			throw new Error(`HTTP error: ${HttpStatusCode[code] || code}`);
		}

		case WebAuthenticationStatus.userCancel: {
			throw new Error('The user did not approve access.');
		}
	}
}

const googleCallbackUrl = 'http://localhost/';
const googleCallbackUri = new Uri(googleCallbackUrl);

export const identity: typeof chrome.identity = {
	getAuthToken: wrapAsync(async (details: chrome.identity.TokenDetails = {}) => {
		let clientId = '';
		let url = await authenticate(
			false,
			new Uri(`https://accounts.google.com/o/oauth2/auth?client_id=${
				encodeURIComponent(clientId)
			}&redirect_uri=${
				encodeURIComponent(googleCallbackUrl)
			}&response_type=code&scope=${
				encodeURIComponent(details.scopes.join(' '))
			}`),
			googleCallbackUri
		);
		let code = new Uri(url).queryParsed.getFirstValueByName('code');
		let content = new StringMap();
		content.insert('code', code);
		content.insert('client_id', clientId);
		content.insert('redirect_uri', googleCallbackUrl);
		content.insert('grant_type', 'authorization_code');
		let http = new HttpClient();
		try {
			let response = await http.postAsync(new Uri('https://www.googleapis.com/oauth2/v4/token'), new HttpFormUrlEncodedContent(content));
			try {
				response.ensureSuccessStatusCode();
				let {
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_in: expiresIn
				}: {
					access_token: string,
					refresh_token: string,
					expires_in: number
				} = JSON.parse(await response.content.readAsStringAsync());
				return accessToken;
			} finally {
				response.close();
			}
		} finally {
			http.close();
		}
	}),

	getProfileUserInfo: wrapAsync(async () => ({
		email: '',
		id: ''
	})),

	launchWebAuthFlow: wrapAsync((details: chrome.identity.WebAuthFlowOptions) => authenticate(
		details.interactive,
		new Uri(details.url),
		new Uri(identity.getRedirectURL())
	)),

	getRedirectURL: (path?: string) => `https://${runtime.id}.chromiumapp.org/${path.replace(/^\//, '')}`
};