export enum Algorithm {
  CatmullRom = 'Catmull-Rom',
  BezierCatmullRom = 'Bezier Catmull-Rom',
  Step = 'Step',
  Linear = 'Linear',
}

export const DEFAULT_ALGORITHM: Algorithm = Algorithm.Step;
