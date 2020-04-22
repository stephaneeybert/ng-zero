import { Injectable } from '@angular/core';
import Vex from 'vexflow';
import * as Tone from 'tone';
import { Soundtrack } from '../../model/soundtrack';
import { Device } from '../../model/device';
import { NotationService } from './notation.service';
import { Note } from '../../model/note/note';
import { Measure } from '../../model/measure/measure';
import { Clef } from '../../model/clef';
import { PlacedChord } from '../../model/note/placed-chord';
import { SettingsService } from '@app/views/settings/settings.service';

const SHEET_WIDTH_RATIO = 0.9;
const VEXFLOW_STAVE_HEIGHT = 50;
const VEXFLOW_STAVE_MARGIN = 50;
const VEXFLOW_OCTAVE_SEPARATOR = '/';
const VEXFLOW_REST_NOTE = 'B/4';
const VEXFLOW_REST_SUFFIX = 'r';
const VEXFLOW_TIME_SIGNATURE_SEPARATOR = '/';
const VEXFLOW_NOTE_COLOR = 'black';
const VEXFLOW_STAVE_BACKGROUND_COLOR = 'white';
const VEXFLOW_NOTE_HIGHLIGHT_COLOR = 'olivedrab';
const VEXFLOW_FONT_TYPE = 'Arial';
const VEXFLOW_FONT_SIZE = 10;
const VEXFLOW_FONT_WEIGHT = '';
const VEXFLOW_FONT_WEIGHT_BOLD = 'Bold';
const VEXFLOW_SVG_OPACITY_TO_SHOW: string = '100';
const VEXFLOW_SVG_OPACITY_TO_HIDE: string = '0';

const VEXFLOW_DOUBLE_BAR = '||';
const VEXFLOW_REPEAT_BEGIN = '|:';
const VEXFLOW_REPEAT_END = ':|';
const VEXFLOW_DOUBLE_REPEAT = '::';
const VEXFLOW_END_BAR = '|=';

export enum VexfloWAccidental {
  sharp = '#',
  flat = 'b',
  o = 'o',
  k = 'k',
  natural = 'n',
  doubleFlat = 'bb',
  doubleSharp = '##'
}

@Injectable({
  providedIn: 'root'
})
export class SheetService {

  constructor(
    private notationService: NotationService,
    private settingsService: SettingsService
  ) { }

  public createSoundtrackSheet(name: string, screenWidth: number, soundtrack: Soundtrack): void {
    this.vexflowRenderSoundtrack(name, screenWidth, soundtrack);
  }

  public vexflowRenderDevice(name: string, screenWidth: number, device: Device): void {
    // TODO
  }

  private getNbStaves(soundtrack: Soundtrack): number {
    let nbMeasures: number = 0;
    if (soundtrack.hasTracks()) {
      for (const track of soundtrack.tracks) {
        if (track.hasMeasures()) {
          for (const measure of track.measures) {
            if (measure.placedChords) {
              if (!this.notationService.isOnlyEndOfTrackChords(measure.placedChords)) {
                nbMeasures++;;
              }
            } else {
              throw new Error('The measure placed chords array has not been instantiated.');
            }
          }
        }
      }
    }
    return nbMeasures;
  }

  private addAccidentalOnNotes(placedChord: PlacedChord): void {
    if (placedChord.staveNote) {
      const staveNote: Vex.Flow.StaveNote = placedChord.staveNote;
      let i: number = 0;
      placedChord.notes.forEach((note: Note) => {
        if (note.pitch.accidental) {
          staveNote.addAccidental(i, new Vex.Flow.Accidental(note.pitch.accidental));
        }
        i++;
      })
    }
  }

  private addDotOnNotes(placedChord: PlacedChord): void {
    if (placedChord.staveNote) {
      const staveNote: Vex.Flow.StaveNote = placedChord.staveNote;
      if (placedChord.dottedAll) {
        staveNote.addDotToAll();
      } else {
        let i: number = 0;
        placedChord.notes.forEach((note: Note) => {
          if (note.dotted) {
            staveNote.addDot(i);
          }
          i++;
        })
      }
    }
  }

  private vexflowRenderSoundtrack(name: string, screenWidth: number, soundtrack: Soundtrack): void {
    // The width must fit within the screen
    const displayWidth = screenWidth * SHEET_WIDTH_RATIO;
    let previousNoteName: string = '';

    let sheetWidth: number;
    let sheetHeight: number;
    const animatedStave: boolean = this.settingsService.getSettings().animatedStave;
    // const sheetWidth: number = nbMeasures * displayWidth; // TODO one long stave
    if (animatedStave) {
      sheetWidth = displayWidth;
      sheetHeight = VEXFLOW_STAVE_HEIGHT + (VEXFLOW_STAVE_MARGIN * 2);
    } else {
      sheetWidth = displayWidth;
      sheetHeight = this.getNbStaves(soundtrack) * (VEXFLOW_STAVE_HEIGHT + VEXFLOW_STAVE_MARGIN);
    }
    const context: any = this.renderVexflowContext(name, sheetWidth, sheetHeight);
    soundtrack.sheetContext = context;
    const formatter = new Vex.Flow.Formatter();
    const voices: Array<Vex.Flow.Voice> = new Array<Vex.Flow.Voice>();
    if (soundtrack.hasTracks()) {
      for (const track of soundtrack.tracks) {
        if (track.hasMeasures()) {
          let staveIndex: number = 0;
          for (const measure of track.getSortedMeasures()) {
            if (measure.placedChords) {
              if (!this.notationService.isOnlyEndOfTrackChords(measure.placedChords)) {
                let staveX: number;
                let staveY: number;
                let staveWidth: number;
                // staveX = (displayWidth * staveIndex); // TODO one long stave
                // staveY = (VEXFLOW_STAVE_HEIGHT + VEXFLOW_STAVE_MARGIN);
                // staveWidth = displayWidth;
                if (animatedStave) {
                  staveX = 0;
                  staveY = 0;
                  staveWidth = displayWidth;
                } else {
                  staveX = 0;
                  staveY = staveIndex * (VEXFLOW_STAVE_HEIGHT + VEXFLOW_STAVE_MARGIN);
                  staveWidth = displayWidth;
                }
                const stave = new Vex.Flow.Stave(staveX, staveY, staveWidth);
                stave.setContext(context);
                stave.addClef(Clef.TREBLE); // TODO Should the clef be determined from the time signature of the measure ?
                stave.addTimeSignature(this.renderTimeSignature(measure));
                if (!animatedStave) {
                  stave.draw();
                }
                measure.sheetStave = stave;

                const staveNotes = new Array<Vex.Flow.StaveNote>();

                const voice: Vex.Flow.Voice = new Vex.Flow.Voice({
                  num_beats: measure.timeSignature.numerator,
                  beat_value: measure.timeSignature.denominator,
                  resolution: Vex.Flow.RESOLUTION
                });
                voice.setStrict(false);
                voice.setStave(stave);
                for (const placedChord of measure.placedChords) {
                  if (!this.notationService.isEndOfTrackPlacedChord(placedChord)) {
                    const chordDuration: string = this.renderDuration(placedChord);
                    const staveNote: Vex.Flow.StaveNote = new Vex.Flow.StaveNote({
                      keys: this.renderNotesSortedByFrequency(placedChord.notes),
                      duration: chordDuration,
                      auto_stem: true,
                      clef: Clef.TREBLE
                    });

                    this.addAccidentalOnNotes(placedChord);
                    this.addDotOnNotes(placedChord);

                    staveNote.setStyle({
                      fillStyle: VEXFLOW_NOTE_COLOR,
                      strokeStyle: VEXFLOW_NOTE_COLOR
                    });

                    const noteName: string = this.renderChordNoteInSyllabic(placedChord);
                    if (noteName !== previousNoteName) {
                      staveNote.addAnnotation(0, this.renderAnnotation(noteName));
                      previousNoteName = noteName;
                    }

                    // Store the stave note for later access
                    placedChord.staveNote = staveNote;

                    staveNotes.push(staveNote);
                  }
                }

                voice.addTickables(staveNotes);
                formatter.joinVoices([voice]);
                formatter.formatToStave([voice], stave);
                if (!animatedStave) {
                  voice.draw(context);
                }
                measure.sheetVoice = voice;
                voices.push(voice);
                staveIndex++;
              }
            } else {
              throw new Error('The measure placed chords array has not been instantiated.');
            }
          }
        }
      }
      if (animatedStave) {
        this.drawFirstMeasure(soundtrack);
      }
    }
  }

  public drawFirstMeasure(soundtrack: Soundtrack): void {
    if (soundtrack.tracks) {
      for (const track of soundtrack.tracks) {
        if (track.hasMeasures()) {
          this.drawMeasure(track.measures[0], soundtrack.sheetContext);
        }
      }
    }
  }

  public drawMeasure(measure: Measure, context: any): void {
    if (measure.sheetStave) {
      measure.sheetStave.draw();
    }
    if (measure.sheetVoice) {
      measure.sheetVoice.draw(context);
    }
  }

  public whitewashStave(context: any): void {
    context.save();
    context.setFillStyle(VEXFLOW_STAVE_BACKGROUND_COLOR);
    context.fillRect(0, 0, context.width, context.height);
    context.restore();
  }

  public vexflowHighlightStaveNote(placedChord: PlacedChord, context: any): void {
    // Hide the highlighted note before loosing its reference
    if (placedChord.sheetStaveNoteHighlightGroup) {
      placedChord.sheetStaveNoteHighlightGroup.style.opacity = VEXFLOW_SVG_OPACITY_TO_HIDE;
    }

    const sheetStaveNoteGroup: any = context.openGroup();
    this.vexflowStyleStaveNote(placedChord, VEXFLOW_NOTE_HIGHLIGHT_COLOR)
      .draw();
    context.closeGroup();
    placedChord.sheetStaveNoteHighlightGroup = sheetStaveNoteGroup;
  }

  public vexflowUnhighlightStaveNote(placedChord: PlacedChord, context: any): void {
    // Hide the highlighted note before loosing its reference
    if (placedChord.sheetStaveNoteUnhighlightGroup) {
      placedChord.sheetStaveNoteUnhighlightGroup.style.opacity = VEXFLOW_SVG_OPACITY_TO_HIDE;
    }

    const sheetStaveNoteGroup: any = context.openGroup();
    this.vexflowStyleStaveNote(placedChord, VEXFLOW_NOTE_COLOR)
      .draw();
    context.closeGroup();
    placedChord.sheetStaveNoteUnhighlightGroup = sheetStaveNoteGroup;
  }

  private vexflowStyleStaveNote(placedChord: PlacedChord, color: string): Vex.Flow.StaveNote {
    if (placedChord.staveNote) {
      placedChord.staveNote.setStyle({
        fillStyle: color,
        strokeStyle: color
      });
      return placedChord.staveNote;
    } else {
      throw new Error('The placed chord has no vexflow stave note when styling');
    }
  }

  private renderChordNoteInSyllabic(placedChord: PlacedChord): string {
    return this.notationService.chromaLetterToChromaSyllabic(placedChord.renderFirstNoteChroma());
  }

  private getNoteFrequency(note: Note): number {
    // The accidental must not be present in the note when getting the frequency
    return Tone.Frequency(note.renderAbc()).toFrequency(); // TODO Move to synth service
  }

  private sortNotesByPitch(notes: Array<Note>): Array<Note> {
    return notes.sort((noteA: Note, noteB: Note) => {
      return this.getNoteFrequency(noteA) - this.getNoteFrequency(noteB);
    });
  }

  // The Vexflow API requires that notes be sorted in ascending order before
  // being added as keys to a stave
  private renderNotesSortedByFrequency(notes: Array<Note>): Array<string> {
    const vexflowNotes: Array<string> = new Array<string>();
    this.sortNotesByPitch(notes)
      .forEach((note: Note) => {
        vexflowNotes.push(this.renderNote(note));
      });
    return vexflowNotes;
  }

  private renderAnnotation(textNote: string): Vex.Flow.Annotation {
    return (
      new Vex.Flow.Annotation(textNote))
      .setFont(VEXFLOW_FONT_TYPE, VEXFLOW_FONT_SIZE, VEXFLOW_FONT_WEIGHT)
      .setJustification(Vex.Flow.Annotation.Justify.CENTER_STEM)
      .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.BOTTOM);
  }

  private renderNote(note: Note): string {
    let vexflowNote: string = '';
    if (!this.notationService.noteIsNotRest(note)) {
      vexflowNote = VEXFLOW_REST_NOTE;
    } else {
      vexflowNote = note.renderChroma();
      if (note.renderOctave() != null) {
        vexflowNote += VEXFLOW_OCTAVE_SEPARATOR + note.renderOctave();
      }
    }
    return vexflowNote;
  }

  private renderDuration(placedChord: PlacedChord): string {
    if (!this.notationService.placedChordIsNotRest(placedChord)) {
      return placedChord.renderDuration() + VEXFLOW_REST_SUFFIX;
    } else {
      return placedChord.renderDuration();
    }
  }

  private renderTimeSignature(measure: Measure): string {
    return measure.timeSignature.numerator + VEXFLOW_TIME_SIGNATURE_SEPARATOR + measure.timeSignature.denominator;
  }

  private renderVexflowContext(name: string, width: number, height: number): any { // TODO Replace all these any types
    const element = document.getElementById(name);
    const renderer: any = new Vex.Flow.Renderer(element!, Vex.Flow.Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context: any = renderer.getContext();
    // context.setFont('Arial', 10, 0).setBackgroundFillStyle('#eed'); // TODO Hard coded font
    return context;
  }

}
