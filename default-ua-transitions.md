# Contents
- [Introduction](#introduction)
- [Transition Cases](#transition-cases)
- [Problem Statement](#problem-statement)
- [Proposals](#proposals)
  * [Choosing between UA and Custom Transition](#choosing-between-ua-and-custom-transition)
    + [Default Value](#default-value)
    + [Handling Swipes](#handling-swipes)
    + [Global vs Navigation Based](#global-vs-navigation-based)
    + [CSS API](#css-api)
      - [Option 1](#option-1)
      - [Option 2](#option-2)
      - [Option 3](#option-3)
  * [Detecting UA Transition](#detecting-ua-transition)
- [Future Use-Cases](#future-use-cases)
  * [Cross-Document Navigations](#cross-document-navigations)
  * [Subframe Navigations](#subframe-navigations)

# Introduction
Smooth visual transitions as users navigate on the web can lower cognitive load by helping users stay in context. It can also provide a [visual cue](https://www.wired.com/2014/04/swipe-safari-ios-7/) about the destination before initiating the navigation. Both site authors and user-agents (UAs) add visual transitions to their navigations for these use-cases.

However, the user experience is bad if [both the site author and the UA](https://stackoverflow.com/questions/19662434/in-ios-7-safari-how-do-you-differentiate-popstate-events-via-edge-swipe-vs-the) add these transitions: the transitions may conflict and cause confusion for the user. The goal of this proposal is to avoid such cases to ensure only one visual transition is executed at a time.

The ethos guiding the API design are:
* If a visual transition can be defined by both the site author and the UA, the site author takes precendence since they have a better understanding of the design and functionality of their site.

* If site authors can not define the transition, they should be able to detect if a visual transition was executed by the UA (assuming no security/privacy concerns).

# Transition Cases
The matrix of navigation cases which define whether a visual transition could be customized by site authors depends on the following characteristics:

* Swipe (predictive) vs Atomic: An atomic navigation would be clicking a button in the browser UI or a programmatic navigation via [`history.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState). A swipe navigation would be gesture which shows the user a preview of the destination before initiating the navigation. This is also called predictive navigation since the user can choose to initiate the navigation based on the preview.

* Same vs Cross-Document (Same-Origin): Whether site authors can customize a transition today and which APIs are necessary to support customization depends on whether the navigation is same-document or cross-document.

* Same vs Cross-origin: Customization of visual transition when navigating between cross-origin sites should either not be supported or should be extremely limited for security/privacy concerns.

The table below shows the current state for the cross-section of these cases:

* ✅ are cases which are currently customizable.
* ☑ are cases which should be customizable but require new platform APIs.
* ❌ are cases which should not be customizable

|   | Same-Document  |  Cross-Document Same-Origin | Cross-Origin  |
|---|---|---|---|
| Swipe Navigation | ☑ | ☑ | ❌ |
| Atomic Navigation  | ✅ | ☑ | ❌ |

The platform APIs required for cases marked with ☑ are:

* Gesture API: Most platforms have a swipe gesture which is used by the UA to trigger a back/forward navigation. On Android/iOS the gesture is swiping from the screen edge; on Mac, it's a multi-finger swipe. Site authors currently can not consistently intercept these events. Customizing swipe navigations for both same-document and cross-document navigations requires this[^1].

* Persisting Visual State: The transition requires showing visual state from both before/after the navigation. Site authors can do this for same-document navigations but not cross-document. [ViewTransition](https://github.com/WICG/view-transitions/blob/main/explainer.md#cross-document-same-origin-transitions) addresses this gap.

The details for the above APIs are out of scope for this proposal. These are meant to show that there are cases which are currently not customizable by site authors but may become so going forward. The API proposal here should work well if/when one of these cases becomes customizable.

# Problem Statement
There is currently no way for a site author to indicate that the page has a custom visual transition tied to a navigation. For example, if the UA adds a visual transition for an atomic navigation (like clicking the back button), there is no way for the UA and site-author to coordinate the 2 transitions. The results in 2 category of issues:

* Double transitions: Executing both the UA and author defined visual transitions looks like a visual glitch. This [site](https://darkened-relieved-azimuth.glitch.me) shows the issue on Chrome/Safari iOS and Safari on Mac. The site does a cross-fade when the user goes back:

   * If the user navigates using the back button in the UI, a cross-fade defined by the site executes and is the only transition.

   * If the user navigates using a swipe from the edge (iOS) or 2 finger swipe (mac), the UA does a transition showing content of the back entry. The Document then receives a `popState` event for the navigation and performs another visual transition.
   
   This has *compat risk* if the UA adds visual transitions for navigations which can be implicitly customized by the site author, i.e., same-document navigations. This is not a problem for cross-document navigations since customization requires UA primitives like [ViewTransitions](https://drafts.csswg.org/css-view-transitions-1/). The UA can use this to detect if there are custom transitions and give them precedence.
   
* Sub-optimal user experience (UX): It's possible that the transition UX defined by the UA is not ideal given the DOM change associated with a navigation (e.g. scrolling to a different position in the same Document).

   This can be resolved by giving precedence to author defined transitions over UA transitions if the case is customizable. For cases which can't be customized yet (like swipe navigations), it's unclear whether no visual transition is better than the UA default.

# Proposals
## Choosing between UA and Custom Transition
This proposal provides authors control over whether a same-document navigation performs a UA transition. The base primitive is a setting called `same-document-ua-transition` with the following options:

* `enable`: Enables UA transitions for all navigations.
* `disable-atomic`: Disables UA transitions for atomic navigations.
* `disable-swipe`: Disables UA transitions for swipe navigations.

The value can take on any number of options (none, one, or both).

### Default Value
The default value for this setting assumes that UA transitions is an opt-out. In other words, the UA can do a visual transition for any navigation but site authors can opt pages out of them, likely in favour of a custom transition.

Opt-out does come with the compat risk of causing double transitions for sites which already have custom transitions. However, it allows browser UX to be consistent for same-document vs cross-document navigations. This also aligns with the behaviour in WebKit based browsers which already ship with UA transitions for swipe navigations.

An opt-in avoids this compat risk but conservatively disables UA transition on sites which don't have custom transitions.

### Handling Swipes
In the absence of a Gesture API for customizing swipes, authors can use this API to handle swipes in the following ways:

1. Add `disable-swipe` which means no visual transition occurs during the gesture. The site instead does a visual transition when the navigation commits (using the `popState` or `navigate` event). This could be sub-optimal for users since they can't use the previous page's preview to decide whether the navigation should occur.
   However, this is an intentional author request, meaning it's likely the page has a custom transition when the navigation commits and it is more desirable than the UA default.

2. Omit `disable-swipe` which allows the UA to do a visual transition during the gesture. The author can detect the transition using the API described in [Detecting UA Transition](#detecting-ua-transition).

### Global vs Navigation Based
The choice of whether to make `same-document-ua-transition` a global setting that applies to all same-document navigations originating from the current Document, or be configured based on the source/destination URL is also important.

The decision depends on whether authors tend to have custom transitions for a subset of navigations, or whether the behavior for swipes is typically different based on the destination page.

The author could, of course, update the value of the global setting based on what's in the navigation history, but the following cases would still remain infeasible:

* The setting needs to be different for the back and forward entries.
* Browser UI allows the user to traverse multiple entries, so back/forward can jump to any entry in the navigation history.
* The user navigates to a new URL by pasting in the URL bar.

The author could specify this using a pair of URLs, which are the source/destination URLs for the navigation. This would effectively be a list of dictionaries which is 1:1 with a Document as follows:

```
[{
   from: urlPattern("/articles/*");
   to: urlPattern("/index");
   same-document-ua-transition: disable-swipe disable-atomic;
 },
 {
   same-document-ua-transition: disable-atomic;
 }]
```

Specifying the URL builds on the existing [URLPattern](https://wicg.github.io/urlpattern/) concept. Similar to the [specificty](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity) concept in CSS, the list value applied should be chosen based on how narrowly scoped the rule is to a navigation. TODO: Clarify the exact algorithm for this.

The destination URL must be the value before redirects. This is because the setting is applied when the swipe gesture starts, before the navigation is initiated (which will resolve redirects).

### CSS API
The following options are for a CSS based syntax for this API. The current proposal, [Option 1](#option-1), allows setting `same-document-ua-transition` for all same-document navigations originating from the current Document.

[Option 2](#option-2) and [Option 3](#option-3) are future extensions to allow setting it per navigation, if we see use-cases where authors need the capability.

#### Option 1
A new CSS [at-rule](https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule) as described below:

```css
/* Applies to all same-document navigations from this Document */
@same-document-ua-transition: disable-atomic;
```

The default value for `same-document-ua-transition` is `enable` which does not disable any UA transitions.

#### Option 2
Extends the [at-rule](https://developer.mozilla.org/en-US/docs/Web/CSS/At-rule) in Option 1 to take a pair of from/to URLs:

```css
/* Applies to all same-document navigations from this Document */
@same-document-ua-transition {
  same-document-ua-transition: disable-atomic;
}

/* Applies to same-document navigations from the current Document if the destination URL matches "to" */
@same-document-ua-transition {
  to: urlPattern("/index");
  same-document-ua-transition: disable-atomic;
}

/* Applies to same-document navigations from the current Document if the current URL matches "from".
   This avoids the need to use script to change rules based on what the current URL is. */
@same-document-ua-transition {
  from: urlPattern("/articles/*");
  same-document-ua-transition: disable-atomic;
}

/* Applies to same-document navigations from the current Document if the current URL matches "from"
   and the destination URL matches to. */
@same-document-ua-transition {
  from: urlPattern("/articles/*");
  to: urlPattern("/index");
  same-document-ua-transition: disable-atomic disable-swipe;
}
```

The `from` and `to` keywords specify the origin and destination URL for a navigation. `same-document-ua-transition` specifies the value which applies to the navigation.

#### Option 3
A new generic media query to apply rules based on the from/to URL:

```css
/* Applies to same-document navigations from this Document */
@same-document-ua-transition disable-atomic;

/* Applies to same-document navigations from the current Document if the destination URL matches "to" */
@media (to: urlPattern("/articles/*")) {
  same-document-ua-transition: disable-atomic disable-swipe;
}

/* Applies to same-document navigations from the current Document if the current URL matches "from".
   This avoids the need to use script to change rules based on what the current URL is. */
@media (from: urlPattern("/articles/*")) {
  same-document-ua-transition: disable-atomic disable-swipe;
}

/* Applies to same-document navigations from the current Document if the current URL matches "from"
   and the destination URL matches to. */
@media (from: urlPattern("/articles/*")) and (to: urlPattern("/index")) {
  same-document-ua-transition: disable-atomic disable-swipe;
}
```

This media query is useful if we expect other use-cases for rules which should be conditionally applied based on navigation state. But the downside is that we'll need to precisely define the timing for when the "to" media query applies. This is important since a generic query will allow setting any CSS property which affects the rendered state of the current Document.

Since the pattern in option 1 is limited to UA transitions, the timing for the rule can be specific to that feature.

## Detecting UA Transition
For cases where the site is using `disable-atomic`, this tells the author whether a UA has already executed a visual transition. This is needed because whether there was a UA transition depends on whether the navigation was atomic or swipe.

```js
window.addEventListener("popstate", (event) => {
  if (event.hasUAVisualTransition)
    updateDOM(event);
  else
    updateDOMWithVisualTransition(event);
});

navigation.addEventListener("navigate", (event) => {
  if (event.hasUAVisualTransition)
    updateDOM(event);
  else
    updateDOMWithVisualTransition(event);
});
```

This proposal is also documented at [html/8782](https://github.com/whatwg/html/issues/8782). The UA transition may not necessarily finish when this event is dispatched.

# Future Use-Cases

## Cross-Document Navigations
Custom transitions for cross-document navigations require UA primitives. The UA can use this to detect if there are custom transitions and give them precedence over UA transitions. This avoids the need for an explicit API as described in [Choosing between UA and Custom Transition](#choosing-between-ua-and-custom-transition) for these navigations.

* UA transitions for atomic navigations are suppressed if there is a ViewTransition for a navigation.
* UA transitions for swipe navigations are suppressed if the author uses both the Gesture API + ViewTransition for a navigation. If the UA transition is executed, the ViewTransition is suppressed when the navigation commits.

Question: Since ViewTransiton will likely ship before the Gesture API, are there cases where a ViewTransition when navigation commits is better than a UA default transition during swipe? This is technically similar to using `disable-swipe` for a same-doc navigation.

## Subframe Navigations
The UA maintains a combined list of navigation entries across all nested navigables. This means back/forward navigations triggered using the browser UI can navigate the top-level navigable or a nested navigable. The following considerations apply specifically when the navigation targets a nested navigable.

* Double Transitions: Cross-document navigations on same-origin nested navigables have the compat risk of double transitions, similar to same-document navigations. This is because the embedding Document can detect when a navigation starts and ends on a same-origin nested navigable and set up its own visual transition.

* Sub-optimal UX: The ideal transition UX with nested navigables could depend on how the navigable is embedded. For example, a full swipe on the tab content's might not look right for a small widget. This indicates that transitions targeting nested navigables should depend on input from both the Document in the nested navigable and the embedding Document.

[^1]: Note that on iOS, the touch event stream during a back/fwd swipe is dispatched to script: [example](https://scintillating-shadow-pastry.glitch.me/). But the author can not `preventDefault` to take over the gesture. This is different from Android where if the gesture results in a back swipe, the touch events are never dispatched.
