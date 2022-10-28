# [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

This questionare covers the View Transitions API ([spec](https://drafts.csswg.org/css-view-transitions-1/), [explainer](https://github.com/WICG/view-transitions)). Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

Note: This questionnaire is limited to the DOM changes within the same Document. The transition is initiated using a JS API detailed in the spec.

#### 01. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

None. The API allows the developer to cache a visual representation of a DOM tree, switch the DOM state and animate between the 2 DOM states using the cached representation. The cached pixels can't be accessed by the Document but can be targeted for animations, similar to embedding a cross-origin iframe.

#### 02. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

Yes. Some amount of work will be required to cache a post layout representation of the DOM. Since the DOM change can't happen until this preparatory work is complete, it would be possible to observe this. If this becomes an issue, the asynchronous API shape permits us to change the resolution of the timing. This is analogous to how the time to render content might be observable through the timing of requestAnimationFrame (though the source of render costs is different).

The API also includes a promise to know when all animations targeting the generated pseudo-elements are finished. This can already be known using existing Animation APIs and the promise is just a convenience.

#### 03. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This feature does not deal with personal information.

#### 04. How do the features in your specification deal with sensitive information?

This feature does not deal with sensitive information.

#### 05. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

No. The DOM state cached by the browser does not persist across the browsing session.

#### 06. Do the features in your specification expose information about the underlying platform to origins?

As mentioned above, the API signals when caching of the visual state of the DOM is complete and the rendering cost of this operation will be observable. But this information can already be observed via requestAnimationFrame timing.

#### 07. Does this specification allow an origin to send data to the underlying platform?

The API sends transition customization information to the user agent. However, this information is sent using existing primitives on the platform to style and animate pseudo elements.

#### 08. Do features in this specification allow an origin access to sensors on a user’s device?

No.

#### 09. What data do the features in this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

The response to the first question relates here. An origin can learn timing information for the UA to preserve cached rendering of the Document (including nested cross-origin iframes).

#### 10. Do feautres in this specification enable new script execution/loading  mechanisms?

No.

#### 11. Do features in this specification allow an origin to access other devices?

No.

#### 12. Do features in this specification allow an origin some measure of control over a user agent's native UI?

None.

#### 13. What temporary identifiers do the features in this specification create or expose to the web?

None.

#### 14. How does this specification distinguish between behavior in first-party and third-party contexts?

The aim is to permit 3rd-party frames to customize transitions within the frame. Given same-origin policy constraints, a 3rd-party frame will not be able to cause transitions in an embedding frame.

#### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The feature is unaffected by these modes.

#### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Yes.

#### 17. Do features in your specification enable origins to downgrade default security protections?

No.

#### 18. What should this questionnaire have asked?

The questionnaire asked for sufficient information.

