import { FACE_IDS, type FaceId } from '@/content/faces';
import { faceBox, type OpenedId } from '@/content/opened';
import { BadgeBack } from './faces/BadgeBack';
import { BuildScreen } from './faces/BuildScreen';
import { CardBack } from './faces/CardBack';
import { CvScreen } from './faces/CvScreen';
import { DiplomaFace } from './faces/DiplomaFace';

const FACES: Record<FaceId, () => React.JSX.Element> = {
  badge: BadgeBack,
  card: CardBack,
  monitor: BuildScreen,
  cv: CvScreen,
  diploma: DiplomaFace,
};

const isFace = (id: string): id is FaceId => (FACE_IDS as readonly string[]).includes(id);

/**
 * The words on an opened object's face, laid on its render by an affine fit (content/opened.ts
 * faceBox). Server-rendered, so a direct load paints it; after a visitor's open it shows once the
 * render is drawn (globals.css).
 */
export function OpenedFace({ id }: { id: OpenedId }) {
  if (!isFace(id)) return null;
  const Face = FACES[id];
  return (
    <div className="opened__face" data-face={id} style={faceBox(id)}>
      <Face />
    </div>
  );
}
