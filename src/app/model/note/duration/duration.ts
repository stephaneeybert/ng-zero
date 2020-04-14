import { Subdivision } from './subdivision';
import { TempoUnit } from '../../tempo-unit';

export class Duration {

  subdivision: Subdivision;
  unit: TempoUnit;

  constructor(subdivision: Subdivision, tempoUnit: TempoUnit) {
    this.subdivision = subdivision;
    this.unit = tempoUnit;
  }

  public renderValue(): number {
    if (this.subdivision.left > 0) {
      return (this.subdivision.left + this.subdivision.right);
    } else {
      throw new Error('The subdivision left value was not defined.');
    }
  }

  public renderValueWithUnit(): string {
    return this.renderValue() + this.unit;
  }

}
