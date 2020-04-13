// import * as vexflow from 'vexflow';
import { Note } from './note';
import { Duration } from './duration/duration';

export class PlacedChord {

  notes: Array<Note>;
  duration: Duration;
  // TODO This causes an error
  // https://stackoverflow.com/q/60805037/958373
  staveNote: any;
  // staveNote: vexflow.Flow.StaveNote;
  dottedAll: boolean;

  constructor(duration: Duration) {
    this.notes =  new Array<Note>();
    this.duration = duration;
    this.dottedAll = false;
  }

  public addNote(note: Note): void {
    if (note) {
      this.notes.push(note);
    }
  }

  public hasNotes(): boolean {
    if (this.notes != null && this.notes.length > 0) {
      return true;
    } else {
      return false;
    }
  }

  public renderFirstNoteChroma(): string {
    let abc: string = '';
    if (this.notes.length > 0) {
      const sortedNotes: Array<Note> = this.notes.sort((a, b) => a.index - b.index);
      abc = sortedNotes[0].renderChroma();
    }
    return abc;
  }

  public renderAbc(): string {
    let abc: string = '';
    const sortedNotes: Array<Note> = this.notes.sort((a, b) => a.index - b.index);
    for (const note of sortedNotes) {
      if (abc) {
        abc += ' ';
      }
      abc += note.renderAbc();
    }
    return abc;
  }

  public getDuration(): number {
    return this.duration.renderValue();
  }

  public renderDuration(): string {
    return this.duration.renderValueWithUnit();
  }
}
