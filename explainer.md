# Introduction
When a user navigates on the web, they get to see the inner workings of web experiences: flash of white followed by a piece-meal rendering phase. This sequenced user experience results in a higher cognitive load because the user has to connect the dots between where they were, and where they are. Not only that, a smooth animation to transition between scenes also reduces the loading latency perceived by the user even if the actual loading time is the same. For these reasons, most platforms provide easy to use primitives to enable developers to build seamless transitions: [Android](https://developer.android.com/training/transitions/start-activity), [iOS/Mac](https://developer.apple.com/documentation/uikit/uimodaltransitionstyle) and [Windows](https://docs.microsoft.com/en-us/windows/apps/design/motion/page-transitions).

This feature provides developers with the same capability on the web, irrespective of whether the scenes in a transition are rendered across Documents.

# Use-Cases
A visual demo of the transition patterns targeted by this feature are [here](https://material.io/design/motion/the-motion-system.html#transition-patterns). The following is a summary of the semantics of these transition patterns :

* Root Transitions : The full page content animates between 2 web pages with an optional static UI element on top. [Shared axis](https://material.io/design/motion/the-motion-system.html#shared-axis) shows an example.
* Shared Element Transitions : A persistent UI element morphs into another (which could be a UI element on the next page or the whole page) changing its shape and content. [Container transform](https://material.io/design/motion/the-motion-system.html#container-transform) shows an example.
* Entry/Exit Transitions : A UI element animates as it exits or enters the screen. This [issue](https://github.com/WICG/shared-element-transitions/issues/37) shows an example.

These transitions should be feasible in SPAs (Single Page Apps) and MPAs (Multi Page Apps).

# Design
Let's take the example below which shows how the API can be used by a developer to animate the background and a shared element on a same origin navigation (MPA).

### Old Document
```
<html>
<head>
  <style>
    body {
      background-color: blue;
    }
    .animated {
      width: 100px;
      height: 100px;
      background-color: red;
    }
  </style>
</head>
<body>
  <div class="animated" shared-id="shared-header" id="header"></div>
</body>
</html>
```

### New Document
```
<html>
<head>
  <style>
    body {
      background-color: lightblue;
    }
    .animated {
      position: relative;
      top: 100px;
      width: 200px;
      height: 200px;
      background-color: red;
    }
    
    @keyframes fadeIn {
      0% {opacity: 0;}
      100% {opacity: 1;}
    }
    
    @keyframes fadeOut {
      0% {opacity: 1;}
      100% {opacity: 0;}
    }
    
    ::shared-new(#root), ::shared-new(#shared-header) {
      animation: fadeIn 1s;
    }

    ::shared-old(#root), ::shared-old(#shared-header) {
      animation: fadeOut 1s;
    }
    
    ::shared-container(#shared-header) {
      transition: all 1s ease-in;
    }
  </style>
</head>
<body>
  <div class="animated" shared-id="shared-header" id="header"></div>
</body>
</html>
```

The steps taken by the browser during the transition are as follows.

1. When a navigation is initiated on the old Document, create the following pseudo elements in the top layer :
    a. A container and child replaced element for each element with shared-id attribute. These are identified via ::shared-container(#shared-id) and ::shared-old(#shared-id) respectively.
    b. A replaced element for the root/html element identified via ::shared-old(#root).

2. Apply the following UA stylesheet to the pseudo elements on the old page :
```
::shared-old(#root), ::shared-container(#shared-header) {
  position: fixed;
  top: 0px;
  left: 0px;
}

::shared-container(#shared-header) {
  // Container sized to the element's border-box size.
  width: 100px;
  height: 100px;
  
  // A transform mapping the element to its quad in viewport space.
  transform: translate(0px, 0px);
}

::shared-old(#shared-header) {
  position: absolute;
  width: 100%;
  height: 100%;
  content: element(#header);
}

::shared-old(#root) {
  width: 100vw;
  height: 100vh;
  // The output of element() function on the root element.
  content: element(html);
}
```

3. Save the output of the element() function for each pseudo element referenced above with the computed size and transform applied to container elements. Then navigate to the new page leaving the last rendered pixels of the old page on screen.

4. When the new page loads, suppress rendering until resources required for first render have been fetched. This state is currently driven by browser heuristics but the eventual goal is to give deterministic control to developers using a [renderblocking](https://github.com/whatwg/html/issues/7131) attribute.

5. Once the page is ready for first render, create the following pseudo elements in the top layer. This is done until the end of rAF callbacks on the page's first rendering lifecycle update[^1] :
    a. A container and child replaced element for each shared element on the old page using state saved in step 3.
    b. A container and child replaced element for each element with shared-id attribute on the new page. Only the child element is created if a container with the matching id was already created in step a. above.
    c. A replaced element for the root/html element identified via ::shared-old(#root).

6. Apply the following UA stylesheet to the pseudo elements on the new page.
```
::shared-old(#root), ::shared-new(#root), ::shared-container(#shared-header) {
  position: fixed;
  top: 0px;
  left: 0px;
}

::shared-old(#root), ::shared-new(#root) {
  width: 100vw;
  height: 100vh;
  content: element(html);
}
::shared-old(#root) {
  // This is the saved output referenced in step 3.
  content: cached-element(html);
}
::shared-new(#root) {
  content: element(html);
}

::shared-old(#shared-header), ::shared-new(#shared-header) {
  position: absolute;
  width: 100%;
  height: 100%;
  
  content: element(#header);
}
::shared-old(#shared-header) {
  // This is the saved output referenced in step 3.
  content: cached-element(#header);
}
::shared-new(#shared-header) {
  content: element(#header);
}

// Update the container's size and transform to the shared element on the new page.
::shared-container(#shared-header) {
  width: 200px;
  height: 200px;
  transform: translate(0px, 100px);
}
```

7. Once no pseudo element has an active animation, remove them from the top layer.

## Live Animatable Properties
A common capability desirable during transitions is to interpolate styles like border-radius that change the element's shape. The [container transform](https://material.io/design/motion/the-motion-system.html#container-transform) examples show a visual demo of that. Painting properties like the element's border within its image when using the element() function makes this difficult. The following example[^2] shows how developers can control which styles are captured in the element() function vs being applied to the pseudo container on the old page.

```
<html>
<head>
  <style>
    .animated {
      width:100px;
      height:100px;
      border: 10px solid black;
      border-radius: 10% 10%;
      box-shadow: 0px 0px 10px;
      
      &:transition {
        /* Retain the border to ensure it is painted transparent but the box size is unchanged. */
        border: 10px solid transparent;
        border-radius: none;
        box-shadow: none;
      }
    }
    
    ::shared-container(#shared-header) {
      border: 10px solid black;
      border-radius: 10% 10%;
      box-shadow: 0px 0px 10px;
    }
    
    ::shared-old(#shared-header) {
      top: -10px;
      left: -10px;
    }
  </style>
</head>
<body>
  <div class="animated" shared-id="shared-header">hello world</div>
</body>
</html>
```

This capability requires the following changes to the steps mentioned in the design above :
* A new pseudo class ("transition") is introduced which is activated when an element is being displayed using pseudo elements in step 1 and 5.
* When saving state in step 3, the container element's complete style is preserved instead of only the computed size and transform.

## Modifications to element()
The following changes will be made to the element() spec as a part of this proposal :

* The target element must have paint containment (contain:paint) to ensure the element is the containing block for all positioned descendents and generates a stacking context.
* The target element must disallow fragmentation (break-inside:avoid).
* A new cached-element() function is introduced to refer to the saved output of the element() function in step 3) of the design.

# API Examples
## SPA
TODO: Add example

## MPA Script Based
TODO: Add example

# Alternatives Considered
## Heirarchical Properties
This proposal disallows a shared element to be nested inside another shared element. The restriction avoids the need to preserve the hierarchy of the shared elements and associated properties (transform, clip, effects inherited by descendents) when creating pseudo elements. This is a consideration for future iterations of the feature.

## Container/Child Split
One consideration was to render each shared element using a replaced element directly instead of creating a container element. The motivation behind this split is to provide a stacking context to cross-fade the content of old and new shared elements. This was necessary to ensure blending identical pixels is a no-op using [plus-lighter](https://drafts.fxtf.org/compositing/#porterduffcompositingoperators_plus_lighter) blending. While same-origin transitions could avoid this, it enables future extensibility for cross-origin transitions where cross-fading identical images would be common.

## Natively Supported Live Animatable Properties
An alternate approach to the setup described in [Live Animatable Properties](#live-animatable-properties) is to support this natively in the browser by introducing a new content-element() function. This function would behave similar to the element() function except skipping the following properties when painting the element: box decorations and visual effects which generate a stacking context. The image will also be sized to the element's content-box (as opposed to the border-box used by the element() function). The motivation for supporting this natively would be to make these properties animatable instead of requiring developer side changes.

# Security/Privacy Considerations
The security considerations below are limited to same-origin transitions :

* Script can never read pixel content for images generated using the element() function. This is necessary since the document may embed cross-origin content (iframes, CORS resources, etc.) and multiple restricted user information (visited links history, dictionary used for spell check, etc.)
* The Live Animatable Properties could reference resources which are restricted in the incoming document for an MPA navigation. For example, the outgoing document may use a cross-origin image for border-image which can't be accessed by the incoming document due to differences in [COEP](https://wicg.github.io/cross-origin-embedder-policy/). Fetching these styles will fail on the incoming document. For same-origin navigations, the developer already has knowledge of the cross-origin policy on the incoming document. They can ensure not to reference cross-origin resources in the properties made live.

# Related Reading
An aspect of the feature that needs to be defined is the [type of navigations](https://github.com/WICG/app-history#appendix-types-of-navigations) that the outgoing page can configure. We expect this will closely align with the navigations that can be observed by the page using app-history's [navigate event](https://github.com/WICG/app-history#restrictions-on-firing-canceling-and-responding).

[^1]: Standardization of this behaviour is a part of the [renderblocking](https://github.com/whatwg/html/issues/7131) proposal.
[^2]: A working example using the existing element() function in Firefox is [here](https://jsbin.com/fifupusuvo/1/edit?html,output).
