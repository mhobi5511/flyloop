# Flyloop Coach Dashboard Master Prompt

## IMPORTANT

The Coach Dashboard already exists and is functional.

Do **not** rebuild it from scratch.  
Do **not** create a second implementation.  
Do **not** redirect users back to the normal mobile app.  
Do **not** remove existing functionality.

Use the existing Coach Dashboard as the foundation and refactor/improve it into a true Coach Operations Workspace.

The goal is to make the existing dashboard feel like professional desktop/tablet operations software, not like the mobile Coaching page stretched onto a large screen.

---

## Product Philosophy

The Coach Dashboard is **not** the desktop version of the mobile Coaching page.

It is a standalone professional workspace for coaches.

Think of:
- Notion
- Linear
- Figma
- Airtable
- an airport control tower

The coach should feel:

> I can run my entire camp from here.

The Dashboard should answer three questions immediately:
1. What do I need to do?
2. When does it happen?
3. Who is involved?

Everything else is secondary.

---

## Golden Rules

### 1. Time-first, not people-first

The coach primarily thinks in time.

The timetable is the heart of the Coach Dashboard.

Whenever there is a tradeoff between showing more information and giving more space to the timetable, always prioritize the timetable.

### 2. No context switching

A coach should never think:

> Where do I need to go for this?

Every operational task should happen inside the Coach Dashboard.

### 3. Keep mobile unchanged

Do not change the existing mobile Coaching flow.

Mobile remains useful for quick checks and small actions.

The Coach Dashboard is for desktop and tablet.

### 4. Light Flyloop design only

Use the same light visual language as the Tunnel Operations Dashboard.

No separate dark theme.

Use consistent backgrounds, cards, buttons, typography, spacing and colors.

---

## 1. Workspace Behavior

The Coach Dashboard is the permanent workspace.

When clicking:
- New Camp
- New Huck Jam

the user must **not** be redirected to the normal app or mobile Create Wizard.

Instead, the creation flow must open inside the Coach Dashboard.

Recommended behavior:

Coach Dashboard  
→ New Camp  
→ large workspace panel / internal wizard opens  
→ user creates camp  
→ panel closes  
→ Dashboard updates and selects the new camp

Same for New Huck Jam.

The coach should never lose the workspace context.

---

## 2. Dashboard Scope

The Dashboard belongs to the coach, not to one specific camp.

The selected camp/huck jam is the active workspace.

There should be a selector:
- Current Camp
- Current Huck Jam
- New Camp
- New Huck Jam

Only one opportunity is active at a time.

Existing opportunities created before the dashboard must load correctly.

Use the same ownership logic as the existing Coaching page.

---

## 3. Main Layout – Desktop

Desktop should use a professional operations layout.

Recommended structure:

Left sidebar:
- Needs Attention
- Applicants
- Accepted
- Waitlist
- Declined
- Selected participant details below

Main area:
- Live Timetable
- Days side by side
- Slots chronologically sorted
- Participant colors
- Add Slot
- Assign Slot

Header:
- Flyloop / Coach Dashboard
- Camp selector
- Share button
- Activity button
- optional settings/edit controls

The timetable must dominate the screen.

---

## 4. Sidebar Behavior – Desktop

Desktop sidebar should be visible by default, but collapsible with a toggle.

This gives the coach both quick participant access and maximum timetable width when needed.

If sidebar is collapsed:
- timetable expands automatically
- toggle allows reopening

---

## 5. Remove Today / Tomorrow / Entire Camp

Remove these tabs completely:
- Today
- Tomorrow
- Entire Camp

The Coach Dashboard should always show the entire camp timetable.

The coach should not need to switch views.

---

## 6. Share and Activity

Remove permanent right-side Share and Activity panels.

They waste important timetable space.

Move both into the header.

### Share

Header button: **Share**

Opens compact dropdown/modal with:
- Athlete Link
- Camp Link
- Tunnel Dashboard Link if available
- Copy Link
- Share

### Activity

Header button: **Activity**

Opens compact drawer/modal/dropdown with recent activity.

Activity should be accessible, but not permanently visible.

---

## 7. Participant Management

Keep participant groups:
- Needs Attention
- Applicants
- Accepted
- Waitlist
- Declined

These groups should support the timetable, not dominate it.

The coach can fully manage participants:
- accept
- decline
- move to waitlist
- remove
- assign slot
- release slot
- view contact details
- view tunnel time
- view booked minutes

---

## 8. Participant Detail View

When selecting a participant, show the detail view directly below the participant list in the left sidebar.

Do not use the right side for participant details.

The right side belongs to the timetable.

If no participant is selected:
- show nothing or a calm empty state

If selected, show:
- photo if available
- name
- email
- phone
- status
- booked minutes
- booked hours
- tunnel time status
- tunnel account email
- booked slots
- actions

---

## 9. Booked Slots Display

Booked slots inside participant details must be grouped by day.

Do not repeat the date for every slot.

Use this structure:

June 10
- 15:00 — 15 min
- 17:00 — 15 min
- 17:30 — 15 min

June 11
- 10:00 — 15 min
- 10:30 — 15 min

This is cleaner and easier to scan.

---

## 10. Timetable Design

Use the Tunnel Operations Dashboard as the design reference.

The timetable should feel like an operational board.

Requirements:
- days displayed side by side
- slots sorted by time
- participants color-coded
- open slots visually neutral
- full slots clearly distinguishable
- booked slots use participant color
- enough horizontal room for up to 5 camp days

The timetable is the main workspace.

---

## 11. Add Slot

Slot creation should happen directly inside the timetable.

Each day column should have an obvious:

**+ Add Slot**

Clicking Add Slot should allow the coach to enter:
- time
- duration
- capacity

After saving:
- the slot appears immediately in the correct day/time position
- the timetable updates without page reload

The coach should never need to search elsewhere to create a slot.

---

## 12. Assign Slot

Open slots should show:

**Assign Slot**

Clicking Assign Slot opens a compact modal or side panel:
- select accepted participant
- select/confirm minutes if needed
- confirm

After assigning:
- slot updates immediately
- participant color is applied
- booked minutes update
- activity updates
- notifications follow existing logic

---

## 13. Remove Release Slot Button from Cards

Remove the permanent Release Slot button from every booked slot card.

It creates visual clutter.

Booked slots should stay clean and color-coded.

Instead:

Click booked participant slot  
→ participant detail opens  
→ small action menu/popup opens  
→ actions include:
- Release Slot
- Move Slot
- Edit
- Remove

Actions belong inside the detail/action menu, not permanently on every card.

---

## 14. Drag & Drop

Drag & drop is optional.

Only implement it if stable and reliable.

The dashboard must work perfectly without drag & drop.

Prefer explicit actions over unstable animations.

Stability is more important than visual tricks.

---

## 15. Camp Editing Inside Dashboard

The coach should be able to edit camp information inside the dashboard.

No redirect to mobile edit pages.

Editable inside dashboard:
- camp name
- description
- tunnel
- dates
- registration deadline
- booking mode
- price
- currency
- capacity
- publish/unpublish if applicable
- share links
- slot settings

Use inline editing, panels, dialogs or workspace panels.

---

## 16. Booking Modes

Support all existing booking modes.

Additionally support or prepare for:

**Coach Managed**

Meaning:
- participants may join/apply
- only the coach assigns slots
- participants can see their times
- participants cannot select slots themselves

Do not break existing booking modes.

---

## 17. Tablet Optimization

Tablet is not desktop scaled down.

Tablet needs its own optimized layout.

The mobile app remains unchanged.

On tablet:
- timetable is the default visible area
- no huge header
- no large coach card
- no permanent sidebar
- no permanent participants panel
- no permanent Needs Attention panel

The coach should open the dashboard and see the timetable within 2 seconds.

---

## 18. Tablet Header

Use a compact tablet header.

Example:

☰  
Camp Selector  
Share  
Activity  

Immediately below:

Live Timetable

No giant information blocks.

---

## 19. Tablet Sidebar

On tablet, sidebar is collapsed by default.

Use a hamburger menu.

Clicking it opens a slide-over panel.

The panel contains:
- Needs Attention
- Applicants
- Accepted
- Waitlist
- Declined

After selecting something, the panel can close again to return focus to the timetable.

---

## 20. Tablet Participant Workflow

On tablet:
- applicant/participant details should open in a slide-over panel
- timetable context should remain preserved
- user should be able to return to timetable with one click

Coach actions remain available:
- accept
- decline
- waitlist
- remove
- edit
- manage slots

---

## 21. Tablet Coach Card

The coach card must not take the whole width.

Replace it with a compact menu or button.

Example:

**Coach ▼**

Inside:
- New Camp
- New Huck Jam
- Profile
- Logout

No unnecessary space consumption.

---

## 22. Needs Attention

Needs Attention should highlight actionable items only.

Examples:
- new applicants
- participants missing slots
- participants missing tunnel time
- open slots
- waitlist items

This should help the coach know what requires action.

Do not turn it into a generic stats area.

---

## 23. Activity

Activity should show recent operational events.

Examples:
- Albert booked 15 minutes
- Dirk was accepted
- Marc removed from slot
- Tunnel Dashboard shared
- Camp updated

Newest first.

Keep it accessible through the header, not permanently visible.

---

## 24. Design Language

The dashboard should match the professional quality of the Tunnel Operations Dashboard.

Do not stack mobile cards vertically if desktop columns would be better.

Avoid:
- mobile page stretched onto desktop
- long vertical feed
- cluttered cards
- permanent right-side widgets
- unnecessary buttons on every slot

Prefer:
- wide timetable
- side-by-side days
- compact sidebar
- clear hierarchy
- operational controls
- calm visual structure

---

## 25. Do NOT

Do not rebuild the dashboard from scratch.

Do not create a second dashboard.

Do not change the mobile Coaching page.

Do not redirect New Camp/New Huck Jam to the normal app.

Do not use a dark theme.

Do not keep permanent Share/Activity side panels.

Do not show Release Slot button permanently on every timetable card.

Do not force drag & drop if unstable.

Do not hide the timetable below large header sections.

---

## 26. Success Criteria

The update is successful when:
- the existing Coach Dashboard is improved, not replaced
- desktop layout feels like a professional operations workspace
- tablet layout is timetable-first
- mobile Coaching flow remains unchanged
- coach never leaves the Dashboard for operational tasks
- New Camp and New Huck Jam open inside the Dashboard
- entire camp is always shown
- Today/Tomorrow/Entire Camp tabs are removed
- timetable has maximum available space
- days are displayed side by side
- participants are color-coded
- slots can be created directly in the timetable
- open slots can assign participants
- Release Slot is moved into click actions
- participant details appear under the participant list on desktop
- tablet uses slide-over panels
- Share and Activity live in the header
- dashboard uses the same light design language as Tunnel Operations Dashboard
- the coach can run a camp without leaving the workspace
