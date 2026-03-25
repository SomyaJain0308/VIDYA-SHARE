# Vidya Share Major Feature Roadmap (100)

Status legend: `[x]` implemented, `[ ]` queued.

## Core Marketplace (1-20)
1. [x] Multi-photo listings with cover selection and gallery order controls.
2. [x] Saved offers vault persisted to Firestore.
3. [x] Edit and republish flow in My Items.
4. [x] Upload reliability layer with retry, idle timeout, and actionable Firebase errors.
5. [x] Listing draft autosave and restore.
6. [x] Progressive loading in Explore (`Load more`) for scale.
7. [x] Advanced sort modes (newest, lowest price, highest price, best match).
8. [x] Full-text search with typo tolerance (fuzzy matching).
9. [ ] Duplicate listing detection before publish.
10. [ ] Smart category suggestions from title/image hints.
11. [ ] Offer negotiation workflow (counter-offer + accept/decline).
12. [ ] Deal timeline tracker (requested -> reserved -> completed).
13. [ ] Listing boost slots for urgent items (non-paid community queue).
14. [ ] Book bundle listings (sell multiple books as one pack).
15. [ ] Uniform set listings (shirt + pants + tie in one offer).
16. [ ] Suggested price assistant from similar sold listings.
17. [ ] Auto-archive stale listings with renewal prompts.
18. [ ] Seller vacation mode to pause all listings.
19. [ ] Bulk actions in My Items (mark sold, pause, delete).
20. [ ] Listing quality score with publishing checklist.

## Buyer Request Engine (21-30)
21. [ ] Real request-to-listing matcher with relevance scoring.
22. [ ] Instant ping to matched sellers when a request is posted.
23. [ ] Request expiry windows and auto-close rules.
24. [ ] Request edit and bump controls.
25. [ ] Structured request form (class, subject, board, edition, urgency).
26. [ ] Request watchlist and follow updates.
27. [ ] Seller response queue for incoming requests.
28. [ ] Request conversion metrics (requested -> fulfilled).
29. [ ] Duplicate request merging for same item.
30. [ ] Suggested listings panel under every request.

## Trust, Safety, Moderation (31-40)
31. [ ] Verified school badge workflow.
32. [ ] Suspicious listing detector (keyword and behavior heuristics).
33. [ ] Block/report user controls with local mute.
34. [ ] Moderation dashboard with action history.
35. [ ] Community reputation score (fulfilled deals, response quality).
36. [ ] Buyer/seller post-deal ratings with abuse protection.
37. [ ] Safe meetup guidance panel by colony.
38. [ ] Fraud risk alerts for off-platform payment patterns.
39. [ ] Audit logs for admin actions.
40. [ ] Appeal flow for removed listings.

## Auth, Accounts, Identity (41-50)
41. [ ] Unified auth hub with phone, email, Google, and Apple parity UX.
42. [ ] Account linking across providers (same user, multiple sign-ins).
43. [ ] Password reset and email verification journeys.
44. [ ] Session/device management panel.
45. [ ] Optional 2-step verification for sensitive actions.
46. [ ] Profile completion prompts with trust impact preview.
47. [ ] Public profile card with social proof and listing history.
48. [ ] Username/handle and shareable profile URL.
49. [ ] Account export/download data.
50. [ ] Account deactivation and delete flow with safeguards.

## School + Local Network Intelligence (51-60)
51. [ ] School graph with aliases and typo-normalization.
52. [ ] Colony cluster heatmap for active demand.
53. [ ] Pickup hotspot suggestions by neighborhood.
54. [ ] Distance-aware listing priority (same colony first).
55. [ ] Uniform-specific school and section filters.
56. [ ] Class/board mapping for books across schools.
57. [ ] Seasonal demand engine (new session spikes).
58. [ ] Back-to-school smart collections.
59. [ ] Local language labels for school names.
60. [ ] Nearby seller discovery cards.

## Communication + Deals (61-70)
61. [ ] In-app secure chat with quick templates.
62. [ ] Optional masked contact relay (no direct number sharing first).
63. [ ] Scheduled meetup planner with reminders.
64. [ ] Read receipts and response-time badges.
65. [ ] Offer reservation expiry countdown.
66. [ ] Cancel reason flow and mutual feedback.
67. [ ] Buyer shortlist compare view.
68. [ ] Auto-generated handover checklists.
69. [ ] Confirmed handover proof flow.
70. [ ] Post-handover follow-up nudges.

## Media, Catalog, Content Quality (71-80)
71. [ ] Image compression and format optimization pipeline.
72. [ ] Barcode/ISBN enrichment with metadata auto-fill.
73. [ ] OCR for extracting title/class from book covers.
74. [ ] Multi-angle photo guidance overlays during upload.
75. [ ] Background cleanup for product photos.
76. [ ] Watermarking to reduce image misuse.
77. [ ] Video listing support (short preview clips).
78. [ ] Related items recommendations.
79. [ ] Content policy checker before post.
80. [ ] Accessibility alt-text auto-suggestion.

## Growth, Retention, Engagement (81-90)
81. [ ] Personalized home feed by profile and behavior.
82. [ ] Re-engagement notification campaigns.
83. [ ] Referral system with trust-safe incentives.
84. [ ] Saved search alerts.
85. [ ] Seasonal campaigns dashboard (uniform drive, exam books).
86. [ ] Community milestones and impact counters.
87. [ ] Listing performance analytics for sellers.
88. [ ] "Recently viewed" and "continue browsing" rails.
89. [ ] Onboarding coach marks for first-time users.
90. [ ] Feedback widget with issue tagging.

## Platform, Performance, Operations (91-100)
91. [ ] Firestore indexing and query optimization pass.
92. [ ] Storage rules hardening and validation.
93. [ ] Offline-first cache for core browsing.
94. [ ] Error monitoring and release health dashboard.
95. [ ] Feature flags and staged rollouts.
96. [ ] End-to-end test suite for critical user journeys.
97. [ ] SEO + social card optimization for shared listings.
98. [ ] Device-safe layout system (notches, foldables, tablets, desktop ultra-wide).
99. [ ] Core Web Vitals budget and performance gates in CI.
100. [ ] Data backup, retention policy, and recovery runbook.

## Current execution order
1. Ship completed items 1-6 fully to production.
2. Next implementation batch target: 7, 8, 21, 47, 98.
