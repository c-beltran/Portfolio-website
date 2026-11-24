"""
The clips of the room's objects that come forward: the car turns to profile, the ball rolls half a
turn toward you, and the mug's handle swings to the right. No bpy (test_room_movers.py). Their
pivots are level with the world at rest: +Z up, +Y away from the seat.
"""

import flat_movers as F
import room as R

# The handle's direction from the cup's axis at rest, from +X, measured on the model.
MUG_HANDLE_DEG = -32.96

CLIPS = {
    "car_turn": ("car_turn", 0.8, "Z", 0.0, R.CAR["heading_deg"] - 90.0),  # the nose to -X
    "ball_roll": ("ball_roll", 0.8, "X", 0.0, 180.0),
    "mug_tip": ("mug_tip", 0.5, "Z", 0.0, -MUG_HANDLE_DEG),
}


def angle(clip: str, t: float) -> float:
    return F.eased(CLIPS, clip, t)
