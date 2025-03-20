# Automatically generating view transition names

## Overview

CSS view transitions allows matching elements and morphing between them, by giving them the same name in the old and new state.
This allows a lot of flexibility, but introduces a mental burden on developers, as they need to come up with unique names or a way to produce them.

One common use-case for use-transitions is animating between states, while the elements themselves don't morph to other elements. For example,
animating between two states of a grid layout. In those cases, the author doesn't want the "shared element" behavior, but rather to use the
view-transition mechanism (capture, create pseudo-elements, animate them) for animating elements in a way that normal transitions/animations can't.

## Element identity as a name generator

To account for this use case, we allow the authors to specify that a particular element generates its `view-transition-name`.
- The keyword `match-element` generates the name from the element's identity. The name itself is not web-observable, it's like an internal token representing the element, and remaining stable.
- The keyword `auto` generates the name from the element's ID, end if it doesn't exist, reverts to `match-element`. Note that the name is not the element's ID itself, but rather a internal token that is the same token generated for the same id. This is to prevent matches with an explicit `view-transition-name: ident` where `ident` is the same string as the ID.

(Note: the details/naming are discussed in the CSSWG).

## Caveats and alternatives
The main issue with `match-element` (and `auto` when there is no ID present), is that they are specific to the document - they don't work for cross-document view transitions.
This is unlike all/most of the other view-transition features. However, this feature is seen as a DX convenience enhancement, and developers can always resort to using IDs or explicit names.

The alternative that is being developed in parallel is using `attr()` and `ident()` to generate an ID explicitly, e.g. `ident("item-", attr(id))`. This would be very flexible, but feels verbose for the common case.

## [Self-Review Questionnaire: Security and Privacy](https://w3ctag.github.io/security-questionnaire/)

> 01.  What information does this feature expose,
>      and for what purposes?

It does not "expose" any new information.

> 02.  Do features in your specification expose the minimum amount of information
>      necessary to implement the intended functionality?

Yes

> 03.  Do the features in your specification expose personal information,
>      personally-identifiable information (PII), or information derived from
>      either?

No

> 04.  How do the features in your specification deal with sensitive information?

N/A

> 05.  Does data exposed by your specification carry related but distinct information that may not be obvious to users?

No

> 06.  Do the features in your specification introduce state
>      that persists across browsing sessions?

No

> 07.  Do the features in your specification expose information about the
>      underlying platform to origins?

No

> 08.  Does this specification allow an origin to send data to the underlying
>      platform?

No

> 09.  Do features in this specification enable access to device sensors?

No

> 10.  Do features in this specification enable new script execution/loading
>      mechanisms?

No

> 11.  Do features in this specification allow an origin to access other devices?

No

> 12.  Do features in this specification allow an origin some measure of control over
>      a user agent's native UI?

No

> 13.  What temporary identifiers do the features in this specification create or
>      expose to the web?

The generated IDs are specifically not web exposed. We have to make sure there are no leaks in APIs like WAAPI or `getComputedStyle`.

> 14.  How does this specification distinguish between behavior in first-party and
>      third-party contexts?

N/a

> 15.  How do the features in this specification work in the context of a browser’s
>      Private Browsing or Incognito mode?

N/a

> 16.  Does this specification have both "Security Considerations" and "Privacy
>      Considerations" sections?

Yes

> 17.  Do features in your specification enable origins to downgrade default
>      security protections?

No

> 18.  What happens when a document that uses your feature is kept alive in BFCache
>      (instead of getting destroyed) after navigation, and potentially gets reused
>      on future navigations back to the document?

N/a

> 19.  What happens when a document that uses your feature gets disconnected?

Doesn't work

> 20.  Does your feature allow sites to learn about the users use of assistive technology?

No

> 21.  What should this questionnaire have asked?

Nothing in particular.
