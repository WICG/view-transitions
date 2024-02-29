# [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

This questionare covers the [pageswap](https://html.spec.whatwg.org/#the-pageswapevent-interface) event, as
described in this [explainer]([https://github.com/WICG/view-transitions/blob/main/cross-doc-explainer.md](https://github.com/WICG/view-transitions/blob/main/cross-doc-explainer.md#pageswap))). Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

#### 01. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

This feature fires an event if a Document is being hidden (or unloaded) due to a navigation. The event also provides the final url and navigation type via [NavigationActivation](https://html.spec.whatwg.org/#navigationactivation) for same-origin navigations.

#### 02. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

Yes, the `pageswap` event only provides metadata about the navigation if it is same-origin. The event itself is fired for all cross-document navigations (including cross-origin) before `pagehide` for consistency. See relevant discussion [here](https://github.com/whatwg/html/issues/9702#issuecomment-1924461917).

#### 03. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This feature does not deal with personal information.

#### 04. How do the features in your specification deal with sensitive information?

Sensitive information (like the type of navigation and final URL) is only provided for same-origin navigations.

#### 05. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

No.

#### 06. Do the features in your specification expose information about the underlying platform to origins?

No.

#### 07. Does this specification allow an origin to send data to the underlying platform?

No.

#### 08. Do features in this specification allow an origin access to sensors on a user’s device?

No.

#### 09. What data do the features in this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

For same-origin navigations, this event provides the old Document with information about the navigation type and URL of the new Document. This information would already be available to the origin via navigation API.

For cross-origin navigations, this event allows the old Document's origin to know when it is being hidden due to a navigation vs the user closing the tab. The old Document's origin can already learn this for session history navigations, for example if its persisted and restored from BFCache.

#### 10. Do feautres in this specification enable new script execution/loading mechanisms?

No.

#### 11. Do features in this specification allow an origin to access other devices?

No.

#### 12. Do features in this specification allow an origin some measure of control over a user agent's native UI?

None.

#### 13. What temporary identifiers do the features in this specification create or expose to the web?

None.

#### 14. How does this specification distinguish between behavior in first-party and third-party contexts?

No difference. Third-party iframes receive the `pageswap` similar to the main frame or first-party iframes.

#### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The feature is unaffected by these modes.

#### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Yes.

#### 17. Do features in your specification enable origins to downgrade default security protections?

No.

#### 18. What should this questionnaire have asked?

The questionnaire asked for sufficient information.
