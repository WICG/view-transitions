# [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

This questionare covers the Shared/Root Element Transitions API ([explainer](https://github.com/WICG/shared-element-transitions)). Based on the [W3C TAG Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/).

#### 01. What information might this feature expose to Web sites or other parties, and for what purposes is that exposure necessary?

With the current API, the developer is able to "prepare" a custom transition and is informed when that transition is ready (i.e., when the UA has, internally, captured the pre-transition visuals of the page). Upon receiving this notification, the page can then update itself to the new state.  The single-page API also notifies the site when the transition completes. NB: the multi-page API is still being designed (in discussion on [this issue](https://github.com/vmpstr/shared-element-transitions/issues/2)).

In the cross-site navigation transition case, there is a question of whether both the source and destination site for the navigation need to opt-in to the API. We do not think that the API allows the source site to learn about content on the destination site, or vice versa, but this API does allow customization of the user experience when navigating between the two sites. The case that might be of the most concern is shared element transitions. Is it ok to show a smooth transition to a shared element (e.g. a hero image) on a destination site without that site explicitly opting into this behavior? We are currently planning an opt-out for the destination site, which is [the same as how scroll-to-text-fragment works](https://web.dev/text-fragments/#disabling-text-fragments).

#### 02. Do features in your specification expose the minimum amount of information necessary to enable their intended uses?

We think so. Some amount of work will be required to prepare the pre-transition visuals. Since page updates cannot happen until this preparatory work is complete, it would be possible to observe this. If this becomes an issue, the asynchronous API shape permits us to change the resolution of the timing. This is analogous to how the time to render content might be observable through the timing of requestAnimationFrame (though the source of render costs is different). A single-page application may also wish to know when the transition completes in order to resume normal functionality.

#### 03. How do the features in your specification deal with personal information, personally-identifiable information (PII), or information derived from them?

This feature does not deal with personal information.

#### 04. How do the features in your specification deal with sensitive information?

This feature does not deal with sensitive information.

#### 05. Do the features in your specification introduce new state for an origin that persists across browsing sessions?

No. The user agent captures the visuals, pre-transition, but these visuals are not accessible by the page; they are only used in animations upon the upcoming transition.

#### 06. Do the features in your specification expose information about the underlying platform to origins?

As mentioned above, the API will signal when the transition preparation is complete, so the cost of this operation will be observable.

#### 07. Does this specification allow an origin to send data to the underlying platform?

The API sends transition customization information to the user agent. The extent to which the underlying platform is involved in the realization of these customized transitions depends on the implementation details of the user agent.

#### 08. Do features in this specification allow an origin access to sensors on a user’s device?

No.

#### 09. What data do the features in this specification expose to an origin? Please also document what data is identical to data exposed by other features, in the same or different contexts.

The response to the first question relates here. The multi-page API is still being designed, but if this transition impacts compositing/rendering on one of the pages (in order for it to be captured in a texture, say), this will need to be realized. However, these changes should not be observable by script.

#### 10. Do feautres in this specification enable new script execution/loading  mechanisms?

No.

#### 11. Do features in this specification allow an origin to access other devices?

No.

#### 12. Do features in this specification allow an origin some measure of control over a user agent's native UI?

There should be no change for single page applications as they can already realize all these transitions today, albeit with more difficulty. For multi-page applications, this API will permit customized page to page transitions, which is new; previously this transition was determined by the user agent.


#### 13. What temporary identifiers do the features in this specification create or expose to the web?

None.

#### 14. How does this specification distinguish between behavior in first-party and third-party contexts?

The aim is to permit 3rd-party frames to customize transitions within the frame. Given same-origin policy constraints, a 3rd-party frame should not be able to cause custom transitions in an embedding frame.

#### 15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?

The feature is unaffected by these modes.

#### 16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?

Not yet; the API is only at the explainer stage and still in flux.

#### 17. Do features in your specification enable origins to downgrade default security protections?

No.

#### 18. What should this questionnaire have asked?

