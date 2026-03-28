# AI Standalone Studio Workflow

## Default Workflow
The standalone app should have one primary creation workflow:

1. Idea Board
2. Script
3. Starting Images
4. Video Clips
5. Edit
6. Export / Publish

This should be the default top-level creator path.

## Stage Definitions

### 1. Idea Board
Purpose:
- collect concept, tone, references, style, audience, and format

Inputs:
- freeform notes
- reference images
- mood/style tags
- project type: film, episode, trailer, short

Outputs:
- approved concept brief
- project intent
- project format

Completion rule:
- the project has a stable concept brief that can feed script generation

### 2. Script
Purpose:
- convert concept into structured scenes and clip intentions

Inputs:
- concept brief
- project format

Outputs:
- outline
- scene list
- dialogue or narration
- clip-level generation intent

Completion rule:
- each scene has enough structure to produce starting images and clip prompts

### 3. Starting Images
Purpose:
- create one or more image anchors for each planned clip or scene beat

Inputs:
- scene prompts
- visual references
- style selections

Outputs:
- approved image set mapped to scenes/clips

Completion rule:
- at least one approved starting image exists for each clip planned for generation

### 4. Video Clips
Purpose:
- generate video clips from script + starting images

Inputs:
- clip prompts
- approved starting images
- generation settings

Outputs:
- generated clips
- generation status
- clip approval state

Completion rule:
- selected clips are approved and ready to send into editing

### 5. Edit
Purpose:
- assemble approved clips into a publishable cut

Inputs:
- approved generated clips
- stills
- music
- dialogue
- titles

Outputs:
- timeline
- rough cut
- final export candidates

Completion rule:
- a timeline exists and can be exported

### 6. Export / Publish
Purpose:
- render and deliver final outputs

Inputs:
- timeline
- export settings

Outputs:
- MP4 render
- upload back to SocialArena
- publish-ready media records

Completion rule:
- export exists locally and/or is linked back to platform records

## UI Requirement
The app should present these stages as a visible pipeline.

Recommended presentation:

- dashboard shows stage progress for each project
- project header shows current stage
- each stage page has:
  - previous
  - save
  - continue

## Workflow Rule
Users should always know:

- where they are
- what is missing
- what the next step is

If a screen does not help answer those questions, it is likely too complex or premature.

## AI Implementation Rule
When adding features, connect them to a stage.

Every new feature should answer:

- which workflow stage owns this?
- what stage does it unlock?
- what output does it produce for the next stage?

If those answers are unclear, the feature is probably not first-priority.
