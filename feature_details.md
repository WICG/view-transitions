# Feature Details

This document is a detailed description of this feature along with the design assumptions, constraints and targeted use-cases. The aim is to facilitate API discussion and ensure it's structured with a focus on interoperability.

Note that since the API details are still in flux, this may not be consistent with other documentation. Please refer to the documentation in the README file and sample-code to experiment with the current implementation in Chromium.

## Problem Statement
When a user navigates on the web, they get to see the inner workings of web experiences: flash of white followed by a piece-meal rendering phase. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. Not only that, a smooth animation to transition between scenes also reduces the loading latency perceived by the user even if the actual loading time is the same. For these reasons, most platforms provide easy to use primitives to enable developers to build seamless transitions : [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

This feature provides developers with the same capability on the web, irrespective of whether the scenes in a transition are rendered across Documents.

## Use Cases

There are 3 categories of use-cases targeted by this feature which have slightly different motivations and constraints :

### Single Page Apps (SPA)
The transitions targeted by this feature are in theory already possible for SPAs today but these are complicated. The developer needs to retain the previous DOM, asynchronously set up the new DOM, set up animations between live DOM elements for both states and clean up the previous state at the end of the transition. Since live DOM needs to be present for both states at the same time, it's common to get the details wrong (eg, previous state might remain clickable or may stick around after the transition). This leads to difficult-to-debug issues and can have a negative impact on accessibility. We want to make authoring such transitions easier with a native API that offers some level of customization.

### Multi Page Apps (MPA)
It’s not possible to have these transitions today for multi-page apps (or same-origin navigations) and in fact a lack of this ends up being one of the drivers for web authors to create SPAs. We want this API to enable authoring transitions within an MPA with a similar feature set as the SPA case above. 

### Cross Origin Transitions
Cross-origin transitions are infeasible similar to MPAs. A common use-case for this is content aggregator sites (search engines, social media sites, news aggregators, etc.). These sites frequently display a hero image/header which could be animated during the navigation to provide a seamless transition.

Cross-origin transitions have additional security/privacy constraints. In particular we must ensure the feature does not allow any cross-site information sharing which imposes the following restrictions :

* The animations associated with the transition need to be defined completely by the previous Document, which is aware of the site the user is navigating to and has contextual information about the user journey.

* The animations need to be executed such that there are no observable side-effects for the new and previous Document. For example, setting an obscure animation for a specific element on the new Document could be used to exchange information between origins. Enforcing this could influence the stage in the rendering pipeline where the UA executes these animations.

An important assumption in the design of this feature is that it's reasonable to limit customization options for cross-origin transitions to make it easier for UAs to enforce the constraints above. But the API/implementation should strive to not unnecessarily limit capabilities for same-origin transitions due to cross-origin constraints.


## Design
**Disclaimer** : The details in this design focus on the SPA/MPA use-case with extensive customizability. It’s expected that the functionality will be delivered incrementally with the initial version of the API being quite limited in scope. The purpose of exploring the customizability options is to ensure the API can evolve to accommodate them.

There are 2 kinds of semantic transitions which are a part of this feature :

* Enter/Exit Transition : An element which exists only on the new Document animates as it enters the screen. The final state of the element in the new Document provides an end state for the animatable properties. Similarly an element which exists only on the previous Document animates as it exits the screen, with a start state for the animatable properties.

* Paired Transition : An element which exists on both Documents is automatically animated from the start state on the previous Document to the end state on the new Document. The painted content for these elements may or may not be identical, which requires defining the behaviour for transitioning this content.

### Control Flow
This section covers the flow of events during a Document transition for the MPA use-case. The SPA scenario is identical except the events may map to different API points and are dispatched on the same Document. The code-snippets used are a rough API sketch with detailed explanation in subsequent sections.

* The entry point for this API is document.documentTransition. The previous Document provides a url keyed list of elements, referred to as shared elements, which could be animated during a transition. There are a couple of important assumptions here :

    * Root transitions are created by using the `html` element in this API. There may be aspects of the transition where the root element will have special behaviour. But the proposal tries to align it closely with nested elements.

    * The type of navigations the previous Document will be allowed to define a transition for should be similar to the ones supported by app-history’s [navigate event](https://github.com/WICG/app-history#restrictions-on-firing-canceling-and-responding). The most likely exception will be the back/forward buttons. So a common pattern would be to use this API in response to the navigate event.

* When a navigation is initiated to this url, the UA caches a static pixel snapshot for the DOM sub-tree of each shared element. If there is any hierarchical relationship between these elements, they are captured as separate snapshots to allow them to animate independently. The parent element's snapshot excludes content for any embedded shared elements, drawing the background which was earlier occluded by the child element.

* The feature supports a subset of [animatable properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animated_properties) that can be interpolated during a transition. For each of those properties, the UA caches their start value to animate them during the transition. In addition to this metadata, we allow the developer to provide opaque contextual information (a unique identifier for the element, navigation trigger, scroll offset, site version etc.), referred to as propertyMap, about these elements to configure the transition.

```
document.documentTransition.setSameOriginTransitions(
  {“foo.com/a.html” : [{element : document.html, propertyMap : {“id” : “root”}},
                                 {element : document.getElementById(‘shared’), propertyMap : {“id” : “shared”}],
   “foo.com/b.html” : [{element : document.html}]
  });
```

* When the new Document loads, the developer can register an `EventListener` to be notified if a transition was initiated by the previous Document. The event, referred to as `handleTransition`, provides the metadata for elements captured from the previous Document and the previous URL, a detailed explanation is at [Referencing Elements](#referencing-elements). The aim of the `handleTransition` event is to allow the developer to define the animations for a transition using information from both Documents. For instance, a paired element transition may be dropped if the corresponding element in the new Document renders offscreen.

* The `handleTransition` event provides a promise based API to declare the transition parameters asynchronously. The motivation to make this asynchronous is to allow the new Document to go through intermediate layouts before it is ready to be displayed. The first paint for the Document is deferred and the previous Document is displayed until this promise is fulfilled and the transition can be started.

```
document.documentTransition.addEventListener(“handleTransition”, e => {
    e.initializeTransition(transitionFrom(e.url, e.elements));
});

async function transitionFrom(previousUrl, elements) {
    // Wait for resources required for this transition to load.
    await waitForLoad(previousUrl);

    elementTransitions = []
    for (let elem in elements) {
        if (elem.propertyMap[“id”] === “root”) {
          elementTransitions.push({sourceElement : elem, transitionType: “none”});
          elementTransitions.push({destinationElement : document.html, transitionType : “fade”});
        } else if (elem.propertyMap[“id”] === “shared”) {
          elementTransitions.push({sourceElement : elem, destinationElement : document.getElementById(“shared”));
        }
    }
    return elementTransitions;
}
```

* The first rendering lifecycle update after the promise returned by the API resolves is when the animations for this transition are started. This frame also determines the end value for animated properties of shared elements in the new Document, similar to the step on the previous Document to cache the start value for its elements.

* The developer can register another event listener to be notified when all animations associated with this transition have been finished. A caveat to note here is that since the transition is executed with a live DOM for the new Document, any changes to the shared elements in the new Document before this event is dispatched will have undefined behaviour.

### Transition Specification
This section covers the details for capturing element snapshots from the previous Document, declaring animations on elements from both Documents and how content from both Documents is combined during the transition.

#### Element Snapshots
When capturing elements from the previous Document and drawing elements from the new Document, we divide the CSS properties used to style an element into the following categories to define their behaviour during the transition :

##### Flattened Properties
The properties which are flattened into the element’s snapshot. For example, the element’s [background](https://developer.mozilla.org/en-US/docs/Web/CSS/background) or [background-color](https://developer.mozilla.org/en-US/docs/Web/CSS/background-color). A few interesting considerations are outlined below :

* It’s unclear how much painted content for an element should be captured. A shared element could be partially or completely clipped using a CSS clip/clip-path on the element or by an ancestor up to the viewport. However more content may be exposed during the transition TODO: Add example. Since the end state is not known until the new Document loads, this decision needs to be made before the animations for the transition are finalized. The size of the painted content is referred to as “paint bounds” in the rest of the document.

* An element in the subtree of a shared element could have a backdrop-filter which was applied to an ancestor of the shared element TODO: Add example. One option is to make the shared element the backdrop root for any element in its subtree when snapshotting it’s content, effectively flattening the backdrop-filter into the shared element’s snapshot.

##### Animatable Properties
The properties which can be animated during the transition. Each shared element creates a stacking context and the properties which are animated should closely align with effects which are applied to the stacking context output, as opposed to the painted element. The specific property types animatable with this feature are : opacity, filter, clip, transform, clip-path, mask-image, backdrop-filter. The properties which define how an element blends into its parent stacking context (for example mix-blend-mode) are also retained.

While the properties above map directly to an existing CSS concept, we need to define a new concept for paired transitions. Animating the painted content between the elements involves the following animations. In future iterations, we’d like to expose these to the developer for low level customization, either grouped into a single property (`content`) or exposed separately.

* The container size for the element animates from the paint bounds of the previous element to the paint bounds of the new element. During this animation, neither element’s content fits the size of the container. Fitting the painted content within the container is similar to a resize operation to fit a [replaced element’s](https://developer.mozilla.org/en-US/docs/Web/CSS/Replaced_element) content. The default animation uses the behaviour defined by fill mode in [object-fit](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) but customizing this should be supported going forward. TODO : Add example.

* The pixels from the painted content of the 2 elements are blended using a [cross-fade](https://developer.mozilla.org/en-US/docs/Web/CSS/cross-fade()) animation from `cross-fade(previous 100%, new 0%)` to `cross-fade(previous 0%, new 100%)`.

It’s conceivable that support for animatable properties will be added incrementally and not all will be supported across UAs. This is still an open question and one option could be for the API to allow feature detection to detect which properties are supported by the UA. Using an unsupported property on a shared element has undefined behaviour.

#### Animation Configuration
The following fields are used in a dictionary, referred to as `ElementTransition`, to configure a single enter/exit or paired transition :

* `transitionType` : This is an enum to provide a predefined set of animation patterns for enter/exit transitions. These can be explicit patterns like `slide-left` (does a translation in the specified direction) which provide convenient defaults for common use-cases. For instance, sliding a header/footer offscreen. Or higher level abstractions like `previous`/`next` which allow the UA to decide the appropriate animation (for example based on the idiomatic pattern for the native OS).

* `duration` : The total length for this transition.

* `delay` : A Document transition establishes a universal timeline for animations spanning multiple elements. This field indicates the delay in starting animations for this transition on this universal timeline.

* `element` : A reference to the [Element](https://dom.spec.whatwg.org/#interface-element) in the new Document.

* `sharedElement` : A reference to an element in the previous Document, explained in Referencing Elements (#referencing-elements).

If one of `sharedElement` or `element` is set, this is an enter or exit transition respectively. The animations for each animatable property are defined based on `transitionType`. If both `sharedElement` and `element` are set, this is a paired transition. This transition first creates a combined image using painted content from both elements based on the `content` animation specification under [Animatable Properties](#animatable-properties). Other animatable properties are then applied to this combined output.

An [open request](https://github.com/WICG/shared-element-transitions/issues/28) here is the ability to add low-level customization to these animations by specifying a delay, duration, easing curve, keyframes similar to the [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API). A potential option to provide this capability in future iterations is to add a `keyframes` field to this dictionary which supports property types listed under [Animatable Properties](#animatable-properties). The syntax is defined under [Processing a keyframes argument](https://drafts.csswg.org/web-animations-1/#processing-a-keyframes-argument) in Web Animations API. It’s worth mentioning that the keyframes syntax already has a concept of an implicit start/end keyframe which could map to the start/end state for each property computed in the previous/new Document respectively.

#### Referencing Elements
Specifying a transition above requires the new Document to reference elements from the previous Document. We address this problem, along with flexibility to exchange contextual information between Documents, by introducing a placeholder for shared elements captured from the previous Document. The documentTransition APIs mentioned in the following explanation are clarified under [Control Flow](#control-flow).

* The dictionary used to specify a shared element cached from the previous Document in documentTransition.setSameOriginTransitions has the following fields :
    * `element` : A reference to the [Element](https://dom.spec.whatwg.org/#interface-element) in the previous Document.
    * `propertyMap` : A `record<DOMString, any>` provided by the developer to pass any opaque contextual information to the new Document. The value for this map can be any javascript object supported by the [structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
    * `metadataOnly` : A boolean indicating whether the UA should skip capturing the element snapshot, defaults to false. This is purely a performance optimization when a visually identical element is present in both Documents, which would be a common scenario for paired transitions.

* The `handleTransition` event provides the information for a cached element from the previous Document using a new interface called `SharedElement`. It has a `record<DOMString, any> getPropertyMap()` API to retrieve the `propertyMap` value above. This `SharedElement` can then be referenced in `ElementTransition` for declaring exit and/or paired transitions.

#### Hierarchical Properties
The web platform has multiple concepts which define the coordinate space in which the animatable properties referenced above should be interpolated : [Containing Block](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block), [3D rendering context](https://drafts.csswg.org/css-transforms-2/#3d-rendering-contexts); the order in which the elements are stacked : [Stacking context](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context); and the element to which an effect like backdrop-filter is applied : [Backdrop Root](https://drafts.fxtf.org/filter-effects-2/#BackdropRoot). All these concepts are defined based on where an element fits in the DOM hierarchy. These are tricky to reason about in the context of a transition because :

* It is desirable to change the ancestor for these concepts during the transition. For example, an element may be clipped by the viewport instead of an ancestor element as it animates to exit the screen.

* Paired transitions are executed by creating a combined image for elements in the two trees on which the animated properties are applied. Should the transition switch to using a parent stacking context for the shared element in the new Document when a transition starts?

The following steps define the behaviour of how content from the two Documents is drawn together during the transition. The aim is to avoid an element’s visual representation abruptly changing at transition start/end for common use-cases :

* We assume that the dimensions for the initial containing block for both Documents is the same. If this changes, for example because the user resizes the browser window before the transition finishes, the transition is aborted.

* During the transition, the UA creates a new root element (hidden from script), referred to as `TransitionRoot` which establishes the root stacking context and containing block. The background color for the `TransitionRoot` is the same as the background color for the root element in the new Document. By default, all shared elements (including root elements from both Documents) are direct descendants of the `TransitionRoot`.

* TODO : Clarify the details of how properties are computed and animated during the transition.

* We also need to define the order in which elements which share a stacking context are rendered. The current proposal allows the developer to explicitly control this by providing an ordered list (back-to-front) of `ElementTransition` in the `handleTransition.initiateTransition` API. But it’s unclear if this control is unnecessary complexity. The common use-case would be to maintain the same visual order for elements within the previous and new Document to avoid abrupt changes when the transition starts and ends.

A customization option for future iterations is enabling persistence of hierarchical relationships between elements during a transition. Let’s say a Document has a shared element A which has descendant shared elements B, C, D. The developer can specify whether A should form a parent stacking context and containing block for its descendants during the transition. This creates a tree of stacking contexts with elements from both Documents rooted at `TransitionRoot`.

## Security Considerations
Since the design above is limited to same-origin transitions, the only security constraint is to ensure that script can never read pixel content for element snapshots. This is necessary since the Document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)

## Future Work
Subsequent designs should cover the cross-origin use-case and address design considerations specific to that use-case. A few problems restricted to it are :

* Opt-in vs Opt-out : The transition must be decided completely by the previous origin initiating the navigation. This necessitates the ability for the new origin to decide which origins can control a transition to it. It’s unclear whether this should be an opt-in or opt-out. The decision will need to tradeoff limiting the customizability of the transition to ensure there is no potential for abuse to allow an opt-out approach.

* Referencing elements : Same-origin relies on sharing information across documents to reference elements between them, which won’t be an option for cross-origin transitions. This should leverage existing work for [scroll-to-css-selector](https://github.com/bryanmcquade/scroll-to-css-selector).

* Time to First Paint : Same-origin relies on the new Document using an explicit signal to indicate when it is ready for display, which won’t be an option for cross-origin transitions. This will likely need to rely on UA heuristics to decide when the transition is started, especially with an opt-out approach.
