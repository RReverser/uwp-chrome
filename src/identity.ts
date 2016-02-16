import { runtime, wrapAsync } from './runtime';

const { WebAuthenticationBroker, WebAuthenticationOptions, WebAuthenticationStatus } = Windows.Security.Authentication.Web;
const { HttpStatusCode, HttpClient, HttpFormUrlEncodedContent, Headers: { HttpCredentialsHeaderValue } } = Windows.Web.Http;
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

namespace Google {
	const callbackUrl = 'http://localhost/';
	const callbackUri = new Uri(callbackUrl);
	const basicScopes = ['profile', 'email'];
	const exchangeTokenUri = new Uri('https://www.googleapis.com/oauth2/v4/token');
	const profileUri = new Uri('https://www.googleapis.com/plus/v1/people/me');
	
	export interface AuthResult {
		access_token: string;
		token_type: 'Bearer';
		expires_in: number;
		refresh_token?: string;
		id_token?: string;
	}
	
	export interface Profile {
		id: string;
		displayName: string;
		emails: {
			type: 'account' | 'home' | 'work' | 'other';
			value: string;
		}[]
	}

	export var userId = '';
	export var userEmail = '';

	export async function auth(interactive: boolean, clientId: string, scopes: string[] = basicScopes) {
		let url = await authenticate(
			interactive,
			new Uri(`https://accounts.google.com/o/oauth2/auth?client_id=${
				encodeURIComponent(clientId)
			}&redirect_uri=${
				encodeURIComponent(callbackUrl)
			}&response_type=code&scope=${
				encodeURIComponent(scopes.join(' '))
			}`),
			callbackUri
		);
		let code = new Uri(url).queryParsed.getFirstValueByName('code');
		let content = new StringMap();
		content.insert('code', code);
		content.insert('client_id', clientId);
		content.insert('redirect_uri', callbackUrl);
		content.insert('grant_type', 'authorization_code');
		let http = new HttpClient();
		try {
			let response = await http.postAsync(exchangeTokenUri, new HttpFormUrlEncodedContent(content));
			try {
				response.ensureSuccessStatusCode();
				return JSON.parse(await response.content.readAsStringAsync()) as AuthResult;
			} finally {
				response.close();
			}
		} finally {
			http.close();
		}
	}
	
	export async function getProfile(authResult: AuthResult) {
		let http = new HttpClient();
		try {
			http.defaultRequestHeaders.authorization = new HttpCredentialsHeaderValue(authResult.token_type, authResult.access_token);
			let profile = JSON.parse(await http.getStringAsync(profileUri)) as Profile;
			userId = profile.id || '';
			let accEmail = profile.emails.find(email => email.type === 'account');
			userEmail = accEmail ? accEmail.value : '';
			return profile;
		} finally {
			http.close();
		}
	}
}

export const identity: typeof chrome.identity = {
	getAuthToken: wrapAsync(async (details: chrome.identity.TokenDetails = {}) => {
		let { client_id, scopes } = runtime.getManifest().oauth2;
		let authResult = await Google.auth(details.interactive, client_id, details.scopes || scopes);
		return authResult.access_token;
	}),

	getProfileUserInfo: wrapAsync(() => Promise.resolve({
		id: Google.userId,
		email: Google.userEmail
	})),

	launchWebAuthFlow: wrapAsync((details: chrome.identity.WebAuthFlowOptions) => authenticate(
		details.interactive,
		new Uri(details.url),
		new Uri(identity.getRedirectURL())
	)),

	getRedirectURL: (path?: string) => `https://${runtime.id}.chromiumapp.org/${path.replace(/^\//, '')}`
};