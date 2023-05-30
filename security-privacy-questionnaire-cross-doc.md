# [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

This questionare covers the cross-document extensions to the ([View Transitions API spec](https://drafts.csswg.org/css-view-transitions-1/), as
described in [this explainer](https://github.com/WICG/view-transitions/blob/main/cross-doc-explainer.md)). Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

Note: See [previous questionnaire](./security-privacy-questionnaire.md) for security & privacy
considerations for same-document view transitions.

#### 01. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

This feature exposes information about the state of the DOM across two documents. Note that the
documents need to be same-origin, and they both need to opt in to cross-document view transitions.

#### 02. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

Yes. the new document only gets the minimum information necessary to perform the transition, such
as positions and sizes of participating elements. The old document does not receive any new
information at all. Any other information, such as data to help the new document make decisions
about the transition, can be passed by other means (sessionStorage, referrer, query parameters), and
this feature doesn't provide a new mechanism for that.

#### 03. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This feature does not deal with personal information.

#### 04. How do the features in your specification deal with sensitive information?

This feature does not deal with sensitive information.

#### 05. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

No. This feature only applies to same-origin navigations within the same browsing session.

#### 06. Do the features in your specification expose information about the underlying platform to origins?

No. Cases where, for example, a capture cannot take place because of memory restrictions, will not be
observable to the web.

#### 07. Does this specification allow an origin to send data to the underlying platform?

No.

#### 08. Do features in this specification allow an origin access to sensors on a user’s device?

No.

#### 09. What data do the features in this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

Information about the previous same-origin document, limited to positions/sizes of elements marked
for transition, and only if both documents opted in to this.

#### 10. Do feautres in this specification enable new script execution/loading mechanisms?

No.

#### 11. Do features in this specification allow an origin to access other devices?

No.

#### 12. Do features in this specification allow an origin some measure of control over a user agent's native UI?

None.

#### 13. What temporary identifiers do the features in this specification create or expose to the web?

None.

#### 14. How does this specification distinguish between behavior in first-party and third-party contexts?

Third-party iframes perform their transitions in an isolated fashion, without reporting or obsreving
that behavior in their embedder/

#### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The feature is unaffected by these modes.

#### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Yes.

#### 17. Do features in your specification enable origins to downgrade default security protections?

No.

#### 18. What should this questionnaire have asked?

The questionnaire asked for sufficient information.

