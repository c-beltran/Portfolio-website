import { diplomaFace } from '@/content/faces';

/**
 * The diploma's paper, close up: the degree set as a diploma is, over the top of the paper (the
 * render's seal and signature lines stay in view below it).
 */
export function DiplomaFace() {
  const [college, system, degree, field, date] = diplomaFace().lines;
  return (
    <div className="face face--diploma">
      <p className="face__college">{college}</p>
      <p className="face__system">{system}</p>
      <p className="face__degree">{degree}</p>
      <p className="face__field">{field}</p>
      <p className="face__date">{date}</p>
    </div>
  );
}
