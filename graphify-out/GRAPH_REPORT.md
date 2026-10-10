# Graph Report - StudyCircle  (2026-05-03)

## Corpus Check
- 244 files · ~267,280 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 595 nodes · 760 edges · 62 communities detected
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 104 edges
2. `customFetch()` - 59 edges
3. `Skeleton()` - 24 edges
4. `Badge()` - 18 edges
5. `parseErrorBody()` - 8 edges
6. `now()` - 5 edges
7. `inferResponseType()` - 5 edges
8. `parseSuccessBody()` - 5 edges
9. `useIsMobile()` - 4 edges
10. `reducer()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `healthCheck()` --calls--> `customFetch()`  [INFERRED]
  lib\api-client-react\src\generated\api.ts → lib\api-client-react\src\custom-fetch.ts
- `getMe()` --calls--> `customFetch()`  [INFERRED]
  lib\api-client-react\src\generated\api.ts → lib\api-client-react\src\custom-fetch.ts
- `getRecentActivity()` --calls--> `customFetch()`  [INFERRED]
  lib\api-client-react\src\generated\api.ts → lib\api-client-react\src\custom-fetch.ts
- `toggleGoal()` --calls--> `customFetch()`  [INFERRED]
  lib\api-client-react\src\generated\api.ts → lib\api-client-react\src\custom-fetch.ts
- `listStudySessions()` --calls--> `customFetch()`  [INFERRED]
  lib\api-client-react\src\generated\api.ts → lib\api-client-react\src\custom-fetch.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (13): cn(), ButtonGroup(), useCarousel(), cn(), useChart(), cn(), cn(), cn() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (78): createCalendarEvent(), createCircle(), createFocusRoom(), createGoal(), createResource(), createRevisionItem(), discoverCircles(), getCircle() (+70 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (12): getGetPodQueryKey(), getGetPodQueryOptions(), getListExamsQueryKey(), getListExamsQueryOptions(), useGetPod(), useListExams(), ExamsCatalog(), AnimatedStat() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (44): createDoubt(), getCreateCircleMutationOptions(), getCreateDoubtUrl(), getCreateStudySessionMutationOptions(), getGetCircleQueryKey(), getGetCircleQueryOptions(), getGetDoubtQueryKey(), getGetDoubtQueryOptions() (+36 more)

### Community 4 - "Community 4"
Cohesion: 0.26
Nodes (8): buildParticipants(), buildPodMembers(), circleMembers(), daysAgo(), daysAhead(), hoursAgo(), minutesAgo(), now()

### Community 5 - "Community 5"
Cohesion: 0.31
Nodes (7): useIsMobile(), cn(), handleKeyDown(), SidebarMenu(), SidebarMenuButton(), SidebarMenuItem(), useSidebar()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (6): addToRemoveQueue(), dispatch(), genId(), reducer(), toast(), useToast()

### Community 7 - "Community 7"
Cohesion: 0.2
Nodes (5): ThemeProvider(), getGetMeQueryKey(), getGetMeQueryOptions(), useGetMe(), AppLayout()

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (3): handleFinalSubmit(), handleNext(), saveToServer()

### Community 9 - "Community 9"
Cohesion: 0.48
Nodes (5): Pagination(), PaginationEllipsis(), PaginationLink(), PaginationNext(), PaginationPrevious()

### Community 10 - "Community 10"
Cohesion: 0.4
Nodes (2): Calendar(), cn()

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (1): mockupPreviewPlugin()

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (2): loadComponent(), _resolveComponent()

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (1): Toaster()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (3): getListChannelMessagesQueryKey(), getListChannelMessagesQueryOptions(), useListChannelMessages()

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (3): getListRevisionItemsQueryKey(), getListRevisionItemsQueryOptions(), useListRevisionItems()

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (3): getListSubjectsQueryKey(), getListSubjectsQueryOptions(), useListSubjects()

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (3): getHealthCheckQueryKey(), getHealthCheckQueryOptions(), useHealthCheck()

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (3): getGetLeaderboardQueryKey(), getGetLeaderboardQueryOptions(), useGetLeaderboard()

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (3): getListFocusRoomsQueryKey(), getListFocusRoomsQueryOptions(), useListFocusRooms()

### Community 22 - "Community 22"
Cohesion: 0.67
Nodes (3): getListCalendarEventsQueryKey(), getListCalendarEventsQueryOptions(), useListCalendarEvents()

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): getListCirclesQueryKey(), getListCirclesQueryOptions(), useListCircles()

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (3): getGetDashboardSummaryQueryKey(), getGetDashboardSummaryQueryOptions(), useGetDashboardSummary()

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (3): getListCircleChannelsQueryKey(), getListCircleChannelsQueryOptions(), useListCircleChannels()

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (3): getGetFocusRoomQueryKey(), getGetFocusRoomQueryOptions(), useGetFocusRoom()

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (3): getGetAnalyticsOverviewQueryKey(), getGetAnalyticsOverviewQueryOptions(), useGetAnalyticsOverview()

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): getListAchievementsQueryKey(), getListAchievementsQueryOptions(), useListAchievements()

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (3): getListPodsQueryKey(), getListPodsQueryOptions(), useListPods()

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (3): getListResourcesQueryKey(), getListResourcesQueryOptions(), useListResources()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (3): getListStudySessionsQueryKey(), getListStudySessionsQueryOptions(), useListStudySessions()

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (3): getDiscoverCirclesQueryKey(), getDiscoverCirclesQueryOptions(), useDiscoverCircles()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (3): getGetExamAttemptQueryKey(), getGetExamAttemptQueryOptions(), useGetExamAttempt()

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (3): getGetWeeklyStudyMinutesQueryKey(), getGetWeeklyStudyMinutesQueryOptions(), useGetWeeklyStudyMinutes()

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (3): getGetTodayGoalsQueryKey(), getGetTodayGoalsQueryOptions(), useGetTodayGoals()

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (3): getListDoubtsQueryKey(), getListDoubtsQueryOptions(), useListDoubts()

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): getAnswerDoubtMutationOptions(), useAnswerDoubt()

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (2): createStudySession(), getCreateStudySessionUrl()

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (2): getGetTopicPerformanceUrl(), getTopicPerformance()

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (2): getAnalyticsOverview(), getGetAnalyticsOverviewUrl()

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (2): getListResourcesUrl(), listResources()

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (2): getListDoubtsUrl(), listDoubts()

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (2): getJoinCircleMutationOptions(), useJoinCircle()

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (2): getListChannelMessagesUrl(), listChannelMessages()

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (2): getCreateRevisionItemMutationOptions(), useCreateRevisionItem()

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (2): answerDoubt(), getAnswerDoubtUrl()

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (2): getExam(), getGetExamUrl()

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (2): getCreateGoalMutationOptions(), useCreateGoal()

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (2): getStartExamAttemptMutationOptions(), useStartExamAttempt()

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (2): getSubmitExamAttemptMutationOptions(), useSubmitExamAttempt()

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (2): getHealthCheckUrl(), healthCheck()

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (2): getGetRecentActivityUrl(), getRecentActivity()

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (2): getSubmitAnswerMutationOptions(), useSubmitAnswer()

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (2): getCreateCalendarEventMutationOptions(), useCreateCalendarEvent()

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (2): getSubmitAnswerUrl(), submitAnswer()

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (2): getFocusRoom(), getGetFocusRoomUrl()

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (2): getCreateDoubtMutationOptions(), useCreateDoubt()

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (2): getJoinFocusRoomMutationOptions(), useJoinFocusRoom()

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (2): getReviewRevisionItemMutationOptions(), useReviewRevisionItem()

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (2): getCreateResourceMutationOptions(), useCreateResource()

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): getJoinCircleUrl(), joinCircle()

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): getCreateFocusRoomMutationOptions(), useCreateFocusRoom()

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): getReviewRevisionItemUrl(), reviewRevisionItem()

## Knowledge Gaps
- **Thin community `Community 10`** (6 nodes): `calendar.tsx`, `calendar.tsx`, `calendar.tsx`, `handleCreate()`, `Calendar()`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (3 nodes): `mockupPreviewPlugin.ts`, `vite.config.ts`, `mockupPreviewPlugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (3 nodes): `App.tsx`, `loadComponent()`, `_resolveComponent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (3 nodes): `sonner.tsx`, `sonner.tsx`, `Toaster()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `getAnswerDoubtMutationOptions()`, `useAnswerDoubt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `createStudySession()`, `getCreateStudySessionUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `getGetTopicPerformanceUrl()`, `getTopicPerformance()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `getAnalyticsOverview()`, `getGetAnalyticsOverviewUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `getListResourcesUrl()`, `listResources()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `getListDoubtsUrl()`, `listDoubts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `getJoinCircleMutationOptions()`, `useJoinCircle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `getListChannelMessagesUrl()`, `listChannelMessages()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `getCreateRevisionItemMutationOptions()`, `useCreateRevisionItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `answerDoubt()`, `getAnswerDoubtUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `getExam()`, `getGetExamUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `getCreateGoalMutationOptions()`, `useCreateGoal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `getStartExamAttemptMutationOptions()`, `useStartExamAttempt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `getSubmitExamAttemptMutationOptions()`, `useSubmitExamAttempt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `getHealthCheckUrl()`, `healthCheck()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `getGetRecentActivityUrl()`, `getRecentActivity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `getSubmitAnswerMutationOptions()`, `useSubmitAnswer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `getCreateCalendarEventMutationOptions()`, `useCreateCalendarEvent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `getSubmitAnswerUrl()`, `submitAnswer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `getFocusRoom()`, `getGetFocusRoomUrl()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `getCreateDoubtMutationOptions()`, `useCreateDoubt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `getJoinFocusRoomMutationOptions()`, `useJoinFocusRoom()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `getReviewRevisionItemMutationOptions()`, `useReviewRevisionItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `getCreateResourceMutationOptions()`, `useCreateResource()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `getJoinCircleUrl()`, `joinCircle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `getCreateFocusRoomMutationOptions()`, `useCreateFocusRoom()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `getReviewRevisionItemUrl()`, `reviewRevisionItem()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 0` to `Community 9`, `Community 2`, `Community 10`, `Community 5`?**
  _High betweenness centrality (0.257) - this node is a cross-community bridge._
- **Why does `Skeleton()` connect `Community 2` to `Community 8`, `Community 10`, `Community 5`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `customFetch()` (e.g. with `healthCheck()` and `getMe()`) actually correct?**
  _`customFetch()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._