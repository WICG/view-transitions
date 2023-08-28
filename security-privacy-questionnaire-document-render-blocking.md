# [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

This questionare covers the [Document render-blocking proposal](https://github.com/whatwg/html/issues/9332). Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

#### 01. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

None. This API exposes no new information to the site.

#### 02. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

Yes.

#### 03. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This feature does not deal with personal information.

#### 04. How do the features in your specification deal with sensitive information?

This feature does not deal with sensitive information.

#### 05. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

No. The render-blocked state influenced by this feature ends when a Document displayed after the navigation (new or BFCached) draws its first frame.

#### 06. Do the features in your specification expose information about the underlying platform to origins?

No. Any timing change in the first frame introduced by this feature ix explicitly controlled by the developer.

#### 07. Does this specification allow an origin to send data to the underlying platform?

No.

#### 08. Do features in this specification allow an origin access to sensors on a user’s device?

No.

#### 09. What data do the features in this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

None.

#### 10. Do feautres in this specification enable new script execution/loading  mechanisms?

No.

#### 11. Do features in this specification allow an origin to access other devices?

No.

#### 12. Do features in this specification allow an origin some measure of control over a user agent's native UI?

None.

#### 13. What temporary identifiers do the features in this specification create or expose to the web?

None.

#### 14. How does this specification distinguish between behavior in first-party and third-party contexts?

The semantics of render-blocking in cross-origin iframes were already defined when the concept was introduced and reviewed [here](https://github.com/w3ctag/design-reviews/issues/727). This proposal does not change them but the details are reiterated below.

Ideally render-blocking should be limited to the Document using the attribute, i.e., a render-blocked Document should not block rendering for its parent frame or child frames. We can ensure that a parent Document is not impacted if a child Document is render-blocked.

However, it's not always feasible to render a child Document if its parent is render-blocked. For example, until the parent Document has been laid out we can't compute the size or visibility of the child frames. Browser avoid unnecessary rendering work for child frames until they are known to be in or close to the viewport. So a render-blocked parent can also prevent child Documents from rendering. Even if the child frame were allowed to render, its content won't be displayed until the parent Document draws a frame.

#### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The feature is unaffected by these modes.

#### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Yes.

#### 17. Do features in your specification enable origins to downgrade default security protections?

No.

#### 18. What should this questionnaire have asked?

The questionnaire asked for sufficient information.
