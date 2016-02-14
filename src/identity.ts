import { runtime, wrapAsync } from './runtime';

const { WebAuthenticationBroker, WebAuthenticationOptions, WebAuthenticationStatus } = Windows.Security.Authentication.Web;
const { HttpStatusCode } = Windows.Web.Http;
const { Uri } = Windows.Foundation;

export const identity: typeof chrome.identity = {
	launchWebAuthFlow: wrapAsync(async (details: chrome.identity.WebAuthFlowOptions) => {
		let result = await WebAuthenticationBroker.authenticateAsync(
			details.interactive ? WebAuthenticationOptions.none : WebAuthenticationOptions.silentMode,
			new Uri(details.url),
			new Uri(identity.getRedirectURL())
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
		if (result.responseStatus !== WebAuthenticationStatus.success) {
			throw new Error();
		}
	}),

	getRedirectURL: (path?: string) => `https://${runtime.id}.chromiumapp.org/${path.replace(/^\//, '')}`
};