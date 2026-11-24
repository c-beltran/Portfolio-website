# Design

## The idea

You sit in Carlos's chair. The desk shows the work, and the room shows the person: cars, soccer, travel, coffee and El Salvador, home.

## Principles

- **Objects are the navigation.** Each opens a section with its own URL. A Sections list offers the same for keyboards and screen readers.
- **A click should feel physical.** Things you can pick up come forward. Fixed things zoom in.
- **Words are HTML.** The scene has no readable personal text, so copy stays accessible and easy to change.
- **3D is an enhancement.** The rendered desk is a complete site by itself.
- **Motion is optional.** Reduced-motion settings are respected, and looping motion can be paused.

## Objects

| Object         | Section     | On click                | Built   |
| -------------- | ----------- | ----------------------- | ------- |
| Test kit       | Potaflow    | Comes forward and opens | Yes     |
| Phone          | Power Walk  | Comes forward and turns | Yes     |
| Monitor, left  | How I build | Zooms in                | Planned |
| Monitor, right | CV          | Zooms in                | Planned |
| Magnet board   | Travel      | Zooms in                | Planned |
| Badge          | Experience  | Comes forward           | Planned |
| Photo          | About       | Comes forward           | Planned |
| Notepad        | This site   | Comes forward           | Planned |
| Business card  | Contact     | Comes forward           | Planned |
| Model car      | Cars        | Comes forward           | Planned |
| Soccer ball    | Soccer      | Comes forward           | Planned |
| Mug            | Coffee      | Comes forward           | Planned |

Objects marked planned open their section's panel today. The light bar is a switch for day and lamp light.

## Two renderers, one scene

Both come from the same Blender build:

1. **Stills** (Cycles) are the default and the first paint, cropped for each window shape.
2. **Live** (React Three Fiber) uses lighting baked from that scene. A small correction layer matches it to the still at rest.

Object positions are exported from Blender, so the click targets, glows and camera agree.
