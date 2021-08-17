# Shared Element Transitions

This document is a detailed description of the Shared Element Transitions feature along with the design assumptions, constraints and targeted use-cases. The aim is to facilitate API discussion and ensure it's structured with a focus on interoperability.

Note that since the API details are still in flux, this may not be consistent with other documentation. Please refer to the documentation in the [README](https://github.com/WICG/shared-element-transitions/blob/main/README.md) file, which is kept up to date with the latest details of the API.

## Problem Statement
When a user navigates on the web, they get to see the inner workings of web experiences: flash of white followed by a piece-meal rendering phase. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. Not only that, a smooth animation to transition between scenes also reduces the loading latency perceived by the user even if the actual loading time is the same. For these reasons, most platforms provide easy to use primitives to enable developers to build seamless transitions : [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

This feature provides developers with the same capability on the web, irrespective of whether the scenes in a transition are rendered across Documents. The feature supports creating transitions between Documents which share the same [Browsing Context](https://developer.mozilla.org/en-US/docs/Glossary/Browsing_context).

## Use Cases

There are 3 categories of use-cases targeted by this feature which have different motivations and constraints :

### Single Page Apps (SPA)
The transitions targeted by this feature are in theory already possible for SPAs today but are complicated to get right. In order to achieve the same effect, the developer needs to do the following:

* Retain the current version of the DOM
* Asynchronously set up the new version of the DOM
* Set up animations between live DOM elements for both states
* Clean up the previous state at the end of the transition.

Since live DOM needs to be present for both states at the same time, it's common to get the details wrong (eg, previous state might remain clickable or may stick around after the transition). This leads to difficult-to-debug issues and can have a negative impact on accessibility.

We want to make authoring such transitions easy with a native API that offers some level of customization.

### Multi Page Apps (MPA)
It’s not possible to have these transitions today for multi-page apps (a.k.a. same-origin navigations). In fact, a lack of this ends up being one of the drivers for web authors to create SPAs. We want this API to enable authoring transitions within an MPA with a similar feature set as the SPA case above. 

### Cross Origin Transitions
Cross-origin transitions are infeasible similar to MPAs. A common use-case for this is content aggregator sites (search engines, social media sites, news aggregators, etc.). These sites frequently display a hero image/header which could be animated during the navigation to provide a seamless transition.

Cross-origin transitions have additional security/privacy constraints. In particular we must ensure the feature does not allow any cross-site information sharing which imposes the following restrictions :

* The animations associated with the transition need to be defined completely by the previous Document, which is aware of the site the user is navigating to and has contextual information about the user journey.

* The animations need to be executed such that there are no observable side-effects for the new and previous Documents. For example, setting an obscure animation for a specific element on the incoming Document could be used to exchange information between origins. Enforcing no side-effects is an important consideration, since it can influence the stage in the rendering pipeline where the UA executes these animations.

An important assumption in the design of this feature is that it's reasonable to limit customization options for cross-origin transitions to make it easier for UAs to enforce the constraints above. But the API/implementation should strive to not unnecessarily limit capabilities for same-origin transitions due to cross-origin constraints.

## Glossary
| Term | Description |
| ------------- | ------------- |
| Previous Document  | The Document the user is viewing when a navigation is initated. For the SPA case, this is effectively the old version of the DOM. |
| New Document  | The Document which will be current in the session history when a navigation is committed. For the SPA case, this is effectively the new version of the DOM. |
| Root transition | An animation to transition the content for root element of both Documents. |
| Exit transition | An animation which specifies how an element in the previous Document exits the screen. |
| Enter transition | An animation which specifies how an element in the new Document enters the screen. |
| Snapshot | A pixel copy for a DOM subtree. |

## Sample Code
This section explains how the feature can be used to add transitions to MPAs. There are a set of use-cases and edge cases to consider :

### Root Transition
Let's start with a root transition, which adds an animation to the root element of previous and new Documents. Below is a video of the transition we want to create :

[![Video Link for Root Element Transition](https://img.youtube.com/vi/j1EybZbfG5g/0.jpg)](https://www.youtube.com/watch?v=j1EybZbfG5g)

The entry point for this API is a new `document.documentTransition` object. The previous Document provides a list of elements which will be animated during the transition. Since this is root transition, this list only includes the `html` element. The result of calling `documentTransition.setSameOriginTransitionElements` as illustrated below is that the browser caches a copy of the pixels (snapshot) for the `html` element when a navigation to `foo.com/a.html` is initiated.

```
// The list of elements is keyed on url. When a user navigates to
// a url, the corresponding entry in this dictionary is used to
// decide which elements should be cached.
document.documentTransition.setSameOriginTransitionElements(
  {
   “foo.com/a.html” : [{element : document.html}],
  });
```

Now we need to add some code on the new Document. When the new Document loads, script registers a listener for a new event type called `handleTransition`. The event is dispatched if a transition was initiated by the previous Document. The exact Document lifecycle stage before which this event should be registered is TBD.

```
document.documentTransition.addEventListener(
    “handleTransition”, e => {
        e.startTransition(provideTransitionFrom(e.previousUrl, e.previousElements));
    });

async function provideTransitionFrom(previousUrl, previousElements) {
    // Wait for the image on the new page to load before
    // starting the transition.
    await waitForImageLoad();
    
    // Old content slides with a fade out from center to left.
    let oldRootAnimation =
      {previousElement : previousElements[0],
       transitionType : "slide-fade-left"};
    
    // New content is drawn underneath, revealed as the old
    // content slides.
    let newRootAnimation =
      {newElement : document.html,
       transitionType : "none"};

    return [oldRootAnimation, newRootAnimation];
}
```

Adding an event listener for `handleTransition` will result in execution of following steps :

* The browser keeps displaying content for the previous Document when `handleTransition` is dispatched. This does not require the previous Document to be active since the browser can display a cached pixel copy.

* The `handleTransition` event has a field `previousURL` : the URL for the previous Document. And `previousElements` : the list of placeholders for elements passed to `setSameOriginTransitionElements`, clarified in [API Proposal](#api-proposal).

* The `handleTransition` event has an API `startTransition` which takes a promise to allow script to asynchronously prepare the new Document for first paint. The browser continues to display old content until the promise passed to this API resolves. On resolution, this promise provides a list of elements to animate and the type of animation. In the example above, `provideTransitionFrom` returns the root elements for the previous and new Document. Also note that the animation done is based on `transitionType` specified with each element. This is a new enum with a pre-defined list of animation patterns.

### Single Element Transition
We can also set a separate animation for parts of the page by specifying them separately in the API. Let's say we wanted the header to slide up during this transition :

*TODO : Add rough implementation for video.*

Add the elements which will animate independently in the API call on the previous Document. The result is that the browser caches a separate pixel copy for each element in the list.

```
document.documentTransition.setSameOriginTransitionElements(
  {
   “foo.com/a.html” : [{element : document.html},
                       {element : document.getElementById("header")}],
  });
```

The `handleTransition` event on the new Document specifies the animation for the header as follows :

```
document.documentTransition.addEventListener(
    “handleTransition”, e => {
        e.startTransition(provideTransitionFrom(e.previousUrl, e.previousElements));
    });

async function provideTransitionFrom(previousUrl, previousElements) {
    ...
    
    let headerAnimation = 
      {previousElement : previousElements[1],
       transitionType : "slide-up"};
       
    return [oldRootAnimation, newRootAnimation, headerAnimation];
}
```

### Paired Element Transition
In some cases a semantically or visually same element is present in both Documents. We can set up an animation which automatically animates this element from it's old state to the new state :

[![Video Link for Shared Element Transition](https://img.youtube.com/vi/n9zxarKTpQ8/0.jpg)](https://www.youtube.com/watch?v=n9zxarKTpQ8)

Similar to the case above, update the list in `setSameOriginTransitionElements` to include the animated image :

```
document.documentTransition.setSameOriginTransitionElements(
  {
   “foo.com/a.html” : [{element : document.html},
                       {element : document.getElementById("dog")}],
  });
```

And specify a transition which associates these elements in the `handleTransition` event on the new Document :

```
document.documentTransition.addEventListener(
    “handleTransition”, e => {
        e.startTransition(provideTransitionFrom(e.previousUrl, e.previousElements));
    });

async function provideTransitionFrom(previousUrl, previousElements) {
    await waitForImageLoad();
    
    ...
    
    let imageAnimation = 
      {previousElement : previousElements[1],
       newElement : document.getElementById("dog")};
       
    return [oldRootAnimation, newRootAnimation, imageAnimation];
}
```

### Network Latency
Performing a seamless transition requires deferring first paint until the new Document is ready for display. Web authors should ensure that this delay is reasonable and gracefully handle slow network activity. A potential way to do this could be to update the transition based on whether a resource could be fetched within a deadline. Let's take the example of [Paired Element Transition](#paired-element-transition) again :

```
async function provideTransitionFrom(previousUrl, previousElements) {
    ...
    
    bool imageLoaded = await waitForImageLoadWithTimeout();
    
    // Specify a paired transition if the image could be loaded within
    // a deadline.
    if (imageLoaded) {
      let imageAnimation = 
        {previousElement : previousElements[1],
         newElement : document.getElementById("dog")};
       
       return [oldRootAnimation, newRootAnimation, imageAnimation];
    }
    
    // Otherwise fallback to a simpler root transition.
    return [oldRootAnimation, newRootAnimation];
}
```

### New Document Layout
A transition may need to be modified based on the layout of the new document for a given viewport size. Let's pick up the paired transition example again with a smaller browser window, which doesn't look as nice when the new paired element is partially onscreen :

[![Video Link for Shared Element Offscreen Transition](https://img.youtube.com/vi/byFWwcqm0RQ/0.jpg)](https://www.youtube.com/watch?v=byFWwcqm0RQ)

```
async function provideTransitionFrom(previousUrl, previousElements) {
    ...

    let elem = document.getElementById("dog");
    let visibleRect = elem.getBoundingClientRect();
    
    // Only use a paired transition if at least half the element in
    // either direction is onscreen.
    if (visibleRect.width > elem.width / 2 ||
        visibleRect.height > elem.height / 2) {
      let imageAnimation = 
        {previousElement : previousElements[1],
         newElement : elem};
       
       return [oldRootAnimation, newRootAnimation, imageAnimation];
    }
    
    // Otherwise fallback to a simpler root transition.
    return [oldRootAnimation, newRootAnimation];
}
```

### Old Document State
Customizing a transition may depend on state from the old Document. The feature enables this by letting the web author pass contextual information between Documents. The following example considers a case where we use the source of navigation to decide the transition :

[![Video Link for Shared Element Offscreen Transition](https://img.youtube.com/vi/Cxz7ezUiGv8/0.jpg)](https://www.youtube.com/watch?v=Cxz7ezUiGv8)

The old Document passes info about which button click initiated the navigation :

```
document.documentTransition.setSameOriginTransitionElements(
  {
   “foo.com/one.html”   : [{element : document.getElementById("dog"),
                            propertyMap : {"type" : "previous"}],
   “foo.com/three.html” : [{element : document.getElementById("dog"),
                            propertyMap : {"type" : "next"}],
   “foo.com/fifty.html” : [{element : document.getElementById("dog"),
                            propertyMap : {"type" : "random"}]
  });
```

The new Document decides the transition type based on this information :

```
async function provideTransitionFrom(previousUrl, previousElements) {
    ...
    let type = "none";
    switch (previousElements[0].getPropertyMap()["type"]) {
      // Old image slides to the left and fades away.
      case "previous" :
        type = "slide-fade-left";
        break;
      // Old image slides to the right and fades away.
      case "next" :
        type = "slide-fade-right";
        break;
      // Old image scales to grow in size and fades away.
      case "random" :
        type = "explode";
        break;
    }
    
    // Specify an animation for the old image to exit revealing new
    // image.
    let imageAnimation = 
      {previousElement : previousElements[1],
       transitionType : type};
    return [imageAnimation];
}
```

### Integration with App History API
This feature integrates well with the [app-history API](https://github.com/WICG/app-history) which provides developers with a central framework for all navigation related logic. The following code-snippet provides an example :

```
appHistory.addEventListener("navigate", e => {
    if (isSameOrigin(e.destination)) {
      document.documentTransition.setSameOriginTransitionElements({
            e.destination.url : [{element : document.html}]
          });
    }
});
```
Transition handling in the new Document remains the same.

## API Proposal
The proposal below is roughly divided into 3 parts : the APIs used on the old and new Document for a same origin cross-document navigation and the API for a transition within the same Document.

### Previous Document
The first part of the API is a dictionary : `CacheElement`. This is used to specify elements to cache from the previous Document. This dictionary has the following parameters :

* `element` : A reference to the [Element](https://dom.spec.whatwg.org/#interface-element). *TODO : What should we do if layout for this element is disabled when a navigation is initiated?*

* `propertyMap` : A `record<DOMString, any>` provided by the developer to pass any opaque contextual information to the new Document. The navigation trigger in [Old Document State](#old-document-state) is an example of such data. Allowing any javascript object supported by the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) as a value for this map would provide maximum flexibility. The reason for limiting to data cloneable data types is to permit serialization of these objects, if necessary.

The syntax for `documentTransition.setSameOriginTransitionElements` is :

```
document.documentTransition.setSameOriginTransitionElements({
    // nextURL: List of elements to cache.
    USVString : [CacheElement, CacheElement],
    USVString : [CacheElement, CacheElement],
    ...
});
```

Special handling is needed for a list of elements : `[CacheElement_Parent, CacheElement_Child]` where `CacheElement_Child` is a descendant of `CacheElement_Parent`. The parent element's snapshot excludes content for any descendant elements. The space covered by the descendant element shows the background which was earlier occluded by the descendant element.

*TODO: Clarify the syntax for nextURL. This should allow for [URL patterns](https://github.com/WICG/urlpattern).*

### New Document
#### Referencing Elements
The first concept for this feature on the new Document is a class : `PreviousDocumentElement`. This class provides a placeholder used by script in the new Document to reference elements from the previous Document. A `PreviousDocumentElement` object in the new Document maps 1:1 to a `CacheElement` object in the previous Document. This class has a `getPropertyMap()` API to retreive the `record<DOMString, any>` for the corresponding `CacheElement`.

#### Animation Configuration
The Shared Element Transition feature allows the web author to compose a transition by animating a set of elements. For example, animating the roots and sub-elements in [Single Element Transition](#single-element-transition) and [Paired Element Transition](#paired-element-transition). We divide these animations into the following semantic transition types :

* Single Element Transition : An element which exists only on the new Document animates as it enters the screen. An element which exists only on the previous Document animates as it exits the screen. A Root transition can be built using two Single Element Transitions.

* Paired Element Transition : An element which exists on both Documents is automatically animated between them. These elements may or may not be visually identical.

The parameters to confugure an instance of Single Element or Paired Element Transition are specified using a new dictionary type : `ElementTransition`. This dictionary has the following fields :

* `transitionType` : This is an enum to provide a predefined set of animation patterns for Single Element transitions. These can be explicit patterns like `slide-left` (does a translation in the specified direction) or higher level abstractions like `previous`/`next` which allow the UA to decide the appropriate animation (for example based on the idiomatic pattern for the native OS). The exact types are TBD.

* `duration` : The total length for this transition. The browser may cap this to a reasonable limit.

* `delay` : A Document transition establishes a universal timeline for multiple `ElementTransition`s. This field indicates the delay in starting animations for this transition on this universal timeline.

* `newElement` : A reference to the [Element](https://dom.spec.whatwg.org/#interface-element) in the new Document.

* `previousElement` : A reference to a `PreviousDocumentElement` provided in the `handleTransition` event (clarified below).

If exactly one of `newElement` or `previousElement` is set, this is an enter or exit transition respectively. The exact animation itself is defined based on `transitionType`. If both `newElement` and `previousElement` are set, this is a paired transition with explicit start and end state. The details for element snapshots and how they are interpolated during the transition will be captured in a subsequent doc. TODO : Link when the doc is ready.

### Transition Lifecycle
The main entry point for the API in the new Document is the `handleTransition` [event](https://dom.spec.whatwg.org/#interface-event). This event is dispatched prior to first paint of a new Document if the previous Document had initialized a transition using `setSameOriginTransitionElements`. *TODO : Should this survive across redirects if the final URL is same origin?* Script can register for this event using `document.documentTransition` which is an [Event Target](https://dom.spec.whatwg.org/#interface-eventtarget). *TODO : Figure out the exact timing of this event in the Document's lifecycle. We also need to ensure that we allow script to register the event before first paint of the new Document.*

The `handleTransition` event has the following fields :

* `previousUrl` : The URL for the previous Document which initiated this transition.

* `previousElements` : A list of `PreviousDocumentElement`s. These map 1:1 with the list of `CacheElement` passed to `setSameOriginTransitionElements`.

This event also has an API to start the transition : `void startTransition(Promise<sequence<ElementTransition>>)`. The precise semantics of this API are described below :

* The browser keeps displaying visuals for the previous Document until the `handleTransition` event is dispatched. If no call to `startTransition` is made by an [Event Listener](https://dom.spec.whatwg.org/#callbackdef-eventlistener), the transition is aborted.

* The `startTransition` API takes a list of `ElementTransition`s. These transition objects specify the set of animations to execute for the transition. We use a promise based API here to allow the new Document to asynchronously prepare the new Document. Since a page load frequently involves activity like network fetches or disk reads, allowing the prepare to be asynchronous is important.

* The browser continues to display visuals for the previous Document until the promise provided in `startTransition` resolves. The first rendering lifecycle update after this step marks the new Document's first paint and transition start.

We also provide a `transitionEnd` event to be notified when all animations associated with a transition have finished executing. There should ideall be no visual changes to DOM state between the transition start step above and `transitionEnd` event.


### Single Page App API
The API for same-document transitions (or SPAs) aligns very closely with the MPA API. The difference is in the API endpoints for each step described above. The following code-snippet shows a sample root transition :

```
async function doRootTransition() {
    await document.documentTransition.performSameDocumentTransition({ 
        cacheElements : [ {element : document.html} ],
        startCallback : startTransition
    });
}

async function startTransition(previousElements) {
    await waitForNextScene();
    
    let oldRootAnimation = {previousElement : previousElements[0],
                            transitionType : "slide-fade-left"};
    let newRootAnimation = {newElement : document.html,
                            transitionType : "none"};
    
    return [oldRootAnimation, newRootAnimation];
}
```

* The transition is initiated by calling the `performSameDocumentTransition` API. This API takes a list of `CacheElement` which should be cached by the browser for this transition. This is equivalent to initiating a navigation after issuing setSameOriginTransitionElements for a cross-document transition.

* The `performSameDocumentTransition` API also takes a `startCallback` which is invoked by the browser once the step above to capture snapshots is finished. This is equivalent to the `handleTransition` event for cross-document transitions.

* The `startCallback` receives a list of `PreviousDocumentElement`s. The semantics are similar to the `previousElements` field on `handleTransition` event. This callback returns a list of `ElementTransition`s to configure the animations to execute the transition. We use a promise based API here as well to allow asynchronous work for loading the next scene. The browser stops performing visual updates from DOM changes after invoking the `startCallback`. The updates are resumed when the promised returned by this callback resolves. This is equivalent to the `startTransition` API on `handleTransition` event.

* The `performSameDocumentTransition` API returns a promise which is resolved once the associated transition is finished. This is equivalent to the `transitionEnd` event for cross-document transitions.

## Open Questions

* The type of navigations the previous Document will be allowed to define a transition for should be similar to the ones supported by app-history’s [navigate event](https://github.com/WICG/app-history#restrictions-on-firing-canceling-and-responding). The most likely exception will be back/forward buttons which currently do not fire a `navigate` event. So a common pattern would be to use this API in response to the navigate event.

* Both cross-document and same-document transitions require deferring first paint for the new scene which is controlled by script. It's unclear what or if this should have an upper bound.

* Since transitions execute with a live new Document, the state of new Elements can change while a transition is in progress. For example, an image element used in the transition receives more data or is detached from the DOM. It's unclear whether the behaviour here needs to be defined.


## Security Considerations
Since the design above is limited to same-origin transitions, the only security constraint is to ensure that script can never read pixel content for element snapshots. This is necessary since the Document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)

## Future Work
Subsequent designs should cover the cross-origin use-case and address design considerations specific to that use-case. A few problems restricted to it are :

* Opt-in vs Opt-out : The transition must be decided completely by the previous origin initiating the navigation. This necessitates the ability for the new origin to decide which origins can control a transition to it. It’s unclear whether this should be an opt-in or opt-out. The decision will need to tradeoff limiting the customizability of the transition to ensure there is no potential for abuse to allow an opt-out approach.

* Referencing elements : Same-origin relies on sharing information across documents to reference elements between them, which won’t be an option for cross-origin transitions. This should leverage existing work for [scroll-to-css-selector](https://github.com/bryanmcquade/scroll-to-css-selector).

* Time to First Paint : Same-origin relies on the new Document using an explicit signal to indicate when it is ready for display, which won’t be an option for cross-origin transitions. This will likely need to rely on UA heuristics to decide when the transition is started, especially with an opt-out approach.
