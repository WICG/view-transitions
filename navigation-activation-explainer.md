# Contents

# Introduction

[Cross document view-transitions](cross-doc-explainer.md), as well as parts of the Navigation API, expand what web authors can do in a "session", or a "multi-page application", outside the scope of a single document.

We found that in order to do that effectively, authors require some sort of reflection:
Which document did I come from and in what way (back? reload? ordinary navigation)?

For cross-document view-transitions, this is a key building block: in many cases the author needs to know the old/new URL and the navigation type in order to decide how to
style the transition. e.g. which animation to use.

To do this today, a lot of brittle broilerplate code is needed, and even that might not be enough:
- Put something on `sessionStorage` when exiting the old document
- Read it in the new document
- Extract the navigation type from the session history or navigation timing.

# How it works

The concept of "activation" describes the point in time when one document is unloaded (or goes to the bfcache) and the next one is made active. This is an important point in time
for features like cross-document view-transitions.

This feature allows reflection about what happened in this point in time:

```js
// This returns the object that represents information about the last activation of this document.
navigation.activation;

// This is the session history entry for this document at the time of activation, before
// any subsequent same-document navigations took place.
navigation.activation.entry;

// This is the last session history entry that was active in the previous document, before
// it was deactivated.
navigation.activation.from;

// The type of navigation that got us to this document: "`push`", "`replace`", "`reload`", or "`traverse`".
navigation.activation.navigationType;
```

# Examples

## With CSS View Transitions
When authoring cross-document view-transitions, one of the challenges is curating the
style of the transition based on the navigation - to, from, navigation-type.

```js
document.addEventListener("pagereveal", event => {
   if (!event.viewTransition)
      return;
   const from_path = new URL(navigation.activation.from).pathname;
   // Skip transitions from home
   if (from_path === "/home")
      event.viewTransition.skipTransition();
   // Apply a different style when going "back"
   const is_back = navigation.activation.navigationType === "traverse" &&
      navigation.activation.entry?.index === (navigation.activation.from?.index - 1);
   document.documentElement.classList.toggle("back-nav", is_back);
});
```


## Other use-cases
An author might want to hide a paragraph that says "Welcome!" if this is a traversal.

```js
document.addEventListener("pageshow", () => {
   document.documentElement.dataset.navigationType = navigation.activation.navigationType;
});
```

```css
html[data-navigation-type=traverse] .welcome {
   display: none;
}
```

# Security & Privacy
Since `navigation.activation` exposes information about a cross-document navigaiton, we have to make sure it doesn't expose any information that's not otherwise available.
To do that, it follows the current protections of the navigation API: it only exposes the URL and session history index of the previous page if it's also available through the existing navigation API functions. The exception to this is `location.replace`, `navigation.activation` exposes the URL of a replaced entry, but only if it's same-origin as the document you're on (and not the initial `about:blank`).

# Further discussions

For further discussing the issue, please refer to the [HTML spec issue tracker](https://github.com/whatwg/html).
