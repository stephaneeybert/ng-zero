import { Injectable } from '@angular/core';
import * as Tone from 'tone';
import { Chroma } from '@app/model/note/pitch/chroma';
import { Octave } from '@app/model/note/pitch/octave';
import { Duration } from '@app/model/note/duration/duration';
import { Note, NOTE_FLAT, NOTE_SHARP } from '@app/model/note/note';
import { Pitch } from '@app/model/note/pitch/pitch';
import { PlacedChord } from '@app/model/note/placed-chord';
import { Measure } from '@app/model/measure/measure';
import { TimeSignature } from '@app/model/measure/time-signature';
import { TempoUnit, TempoUnitType } from '@app/model/tempo-unit';
import { DEFAULT_TONALITY_C_MAJOR, NOTE_END_OF_TRACK, NOTE_REST, NOTE_CHROMAS_SYLLABIC, CHORD_CHROMAS_SYLLABIC, HALF_TONE_MAJOR_CHROMAS, HALF_TONE_MINOR_CHROMAS, CHROMA_ENHARMONICS, META_CHROMAS, NOTE_RANGE, NOTE_ACCIDENTAL_MINOR, NOTE_RANGE_INTERVALS, CHROMAS_ALPHABETICAL, CHROMAS_MAJOR, CHROMAS_MINOR, NOTE_RANGE_INTERVAL_MAJOR, NOTE_ACCIDENTAL_DIMINISHED } from './notation.constant ';
import { Tonality } from '@app/model/note/tonality';

const CHORD_SEPARATOR: string = ' ';
const CHORD_DURATION_SEPARATOR: string = '/';
const NOTE_SEPARATOR: string = '|';
const NOTE_END_OF_TRACK_OCTAVE: number = 0;
const NOTE_END_OF_TRACK_DURATION: number = 8;
const NOTE_END_OF_TRACK_VELOCITY: number = 0;
const CHROMA_OCTAVE_PATTERN: RegExp = /[a-z#]+|[^a-z#]+/gi;
const CHROMA_SHIFT_TIMES: number = 2;

const DEFAULT_CHORD_DURATION: number = 4;
const DEFAULT_TIME_SIGNATURE_NUMERATOR: number = 4;
const DEFAULT_TIME_SIGNATURE_DENOMINATOR: number = 4;

@Injectable({
  providedIn: 'root'
})
export class NotationService {

  public parseMeasures(textMeasures: Array<string>, tempo: number, timeSignatureNumerator: number, timeSignatureDenominator: number, velocity: number): Array<Measure> {
    const measures: Array<Measure> = new Array<Measure>();
    let measureIndex: number = 0;
    textMeasures.forEach((textMeasure: string) => {
      const placedChords: Array<PlacedChord> = this.parseTextMeasure(textMeasure, velocity);
      const measure: Measure = this.createMeasure(measureIndex, tempo, timeSignatureNumerator, timeSignatureDenominator);
      measure.placedChords = placedChords;
      measureIndex++;
      measures.push(measure);
    });
    return measures;
  }

  public createMeasure(index: number, tempoInBpm: number, timeSignatureNumerator: number, timeSignatureDenominator: number): Measure {
    const timeSignature: TimeSignature = this.createTimeSignature(timeSignatureNumerator, timeSignatureDenominator);
    const measure: Measure = new Measure(index, tempoInBpm, timeSignature);
    return measure;
  }

  private parseTextMeasure(textMeasure: string, velocity: number): Array<PlacedChord> {
    let index: number = 0;
    return textMeasure.split(CHORD_SEPARATOR)
      .map((textChord: string) => {
        const placedChord: PlacedChord = this.parseTextChord(index, textChord, velocity);
        index++;
        return placedChord;
      });
  }

  private parseTextNote(index: number, textNote: string): Note {
    let note: Note;
    let chroma: string;
    let octave: number;
    if (this.abcNoteIsNotRest(textNote)) {
      [chroma, octave] = this.noteToChromaOctave(textNote);
      note = this.createNote(index, chroma, octave);
    } else {
      chroma = textNote;
      octave = 0;
      note = this.createNote(index, chroma, octave);
    }
    return note;
  }

  private parseTextNotes(textNotes: string): Array<Note> {
    let index: number = 0;
    return textNotes.split(NOTE_SEPARATOR)
      .map((textNote: string) => {
        const note: Note = this.parseTextNote(index, textNote);
        index++;
        return note;
      });
  }

  private parseTextChord(index: number, textChord: string, velocity: number): PlacedChord {
    const chordAndDuration: Array<string> = textChord.split(CHORD_DURATION_SEPARATOR);
    const chordNotes: string = chordAndDuration[0];
    const chordDuration: number = Number(chordAndDuration[1]);
    const notes: Array<Note> = this.parseTextNotes(chordNotes);
    const placedChord: PlacedChord = this.createPlacedChord(index, chordDuration, TempoUnit.NOTE, velocity, DEFAULT_TONALITY_C_MAJOR, notes);
    return placedChord;
  }

  private addNotes(placedChord: PlacedChord, notes: Array<Note>): void {
    notes.forEach((note: Note) => {
      placedChord.addNote(note);
    });
  }

  private isRangeMinor(noteRange: NOTE_RANGE): boolean {
    if (noteRange == NOTE_RANGE.MINOR_NATURAL || noteRange == NOTE_RANGE.MINOR_HARMONIC || noteRange == NOTE_RANGE.MINOR_MELODIC) {
      return true;
    } else {
      return false;
    }
  }

  public removeSharpsAndFlats(chroma: string): string {
    return chroma.replace(NOTE_SHARP, '').replace(NOTE_FLAT, '');
  }

  private getNoteFrequency(note: Note): number {
    // The accidental must not be present in the note when getting the frequency
    const chromaOctave: string = this.removeSharpsAndFlats(note.renderIntlChromaOctave());
    return Tone.Frequency(chromaOctave).toFrequency();
  }

  public sortNotesByIndex(notes: Array<Note>): Array<Note> {
    return notes.sort((noteA: Note, noteB: Note) => {
      return noteA.index - noteB.index;
    });
  }

  public sortNotesByFrequency(notes: Array<Note>): Array<Note> {
    return notes.sort((noteA: Note, noteB: Note) => {
      return this.getNoteFrequency(noteA) - this.getNoteFrequency(noteB);
    });
  }

  public getFirstChordNoteSortedByIndex(placedChord: PlacedChord): Note {
    const sortedNotes: Array<Note> = this.sortNotesByIndex(placedChord.notes);
    if (!sortedNotes || sortedNotes.length == 0) {
      throw new Error('The placed chord had no notes to sort by index.');
    }
    return sortedNotes[0];
  }

  private getSecondChordNoteSortedByIndex(placedChord: PlacedChord): Note {
    const sortedNotes: Array<Note> = this.sortNotesByIndex(placedChord.notes);
    if (!sortedNotes || sortedNotes.length < 3) {
      throw new Error('The placed chord had no notes to sort by index.');
    }
    return sortedNotes[1];
  }

  public getFirstNoteSortedByPitch(placedChord: PlacedChord): Note {
    const sortedNotes: Array<Note> = this.sortNotesByFrequency(placedChord.notes);
    if (!sortedNotes || sortedNotes.length == 0) {
      throw new Error('The placed chord had no notes to sort by pitch.');
    }
    const lastIsLowest: number = sortedNotes.length - 1;
    return sortedNotes[lastIsLowest];
  }

  public tonalityFirstChromaLetterToChromaSyllabic(placedChord: PlacedChord): string {
    const chordNameIntl: string = this.getChordIntlName(placedChord);
    let chroma: string = this.chromaLetterToChromaSyllabic(CHORD_CHROMAS_SYLLABIC, chordNameIntl);
    // TODO Do we need this isRangeMinor ?
    // TODO Have the missing m for minor
    if (this.isRangeMinor(placedChord.tonality.range)) {
      chroma += NOTE_ACCIDENTAL_MINOR;
    }
    return chordNameIntl + ' ' + chroma;
  }

  public chordChromaLetterToChromaSyllabic(range: NOTE_RANGE, chroma: string): string {
    let syllabicChroma: string = this.chromaLetterToChromaSyllabic(CHORD_CHROMAS_SYLLABIC, chroma);
    if (this.isRangeMinor(range)) {
      syllabicChroma += NOTE_ACCIDENTAL_MINOR;
    }
    return syllabicChroma;
  }

  public noteChromaLetterToChromaSyllabic(chroma: string): string {
    return this.chromaLetterToChromaSyllabic(NOTE_CHROMAS_SYLLABIC, chroma);
  }

  private chromaLetterToChromaSyllabic(chromasSyllabic: Map<string, string>, chroma: string): string {
    if (chromasSyllabic.has(chroma)) {
      const syllabic: string | undefined = chromasSyllabic.get(chroma);
      if (syllabic) {
        return syllabic;
      } else {
        throw new Error('The chroma letter ' + chroma + ' could not be retrieved in the chromas syllabic ' + chromasSyllabic.keys.toString());
      }
    } else {
      throw new Error('The chroma letter ' + chroma + ' could not be found in the chromas syllabic ' + chromasSyllabic.keys.toString());
    }
  }

  // public selectHalfToneChromasFromFirstChroma(chroma: string): Array<string> {
  //   if (HALF_TONE_SHARP_CHROMAS.includes(chroma)) {
  //     return HALF_TONE_SHARP_CHROMAS;
  //   } else if (HALF_TONE_FLAT_CHROMAS.includes(chroma)) {
  //     return HALF_TONE_FLAT_CHROMAS;
  //   } else {
  //     throw new Error('No chromas array was found containing the chroma ' + chroma);
  //   }
  // } TODO
  public selectHalfToneChromasFromFirstChroma(chroma: string): Array<string> {
    if (HALF_TONE_MAJOR_CHROMAS.includes(chroma)) {
      return HALF_TONE_MAJOR_CHROMAS;
    } else if (HALF_TONE_MINOR_CHROMAS.includes(chroma)) {
      return HALF_TONE_MINOR_CHROMAS;
    } else {
      throw new Error('No chromas array was found containing the chroma ' + chroma);
    }
  }

  public createPlacedChord(index: number, chordDuration: number, tempoUnit: TempoUnitType, velocity: number, tonality: Tonality, notes: Array<Note>): PlacedChord {
    const duration: Duration = this.createDuration(chordDuration, tempoUnit);
    const placedChord: PlacedChord = this.createEmptyChord(index, duration, velocity, tonality);
    this.addNotes(placedChord, notes);
    return placedChord;
  }

  public createNote(index: number, chroma: string, octave: number): Note {
    const pitch: Pitch = this.createPitch(this.createChroma(chroma), this.createOctave(octave));
    const note: Note = new Note(index, pitch);
    return note;
  }

  public noteToChromaOctave(note: string): [string, number] {
    const chromaOctave: Array<string> | null = note.match(CHROMA_OCTAVE_PATTERN);
    if (chromaOctave != null) {
      const chroma: string = chromaOctave[0];
      let octave: number = 0;
      if (chromaOctave.length > 1) {
        octave = Number(chromaOctave[1]);
      } else {
        throw new Error('Unspecified octave for the note: ' + note + ' with chroma: ' + chroma);
      }
      return [chroma, octave];
    }
    throw new Error('The note ' + note + ' is not of a chroma and octave pattern.');
  }

  public placedChordIsNotRest(placedChord: PlacedChord): boolean {
    if (placedChord.hasNotes()) {
      return this.noteIsNotRest(placedChord.notes[0]);
    } else {
      return false;
    }
  }

  public noteIsNotRest(note: Note): boolean {
    return this.abcNoteIsNotRest(note.render());
  }

  public abcNoteIsNotRest(abcNote: string): boolean {
    return !abcNote.includes(NOTE_REST);
  }

  public isEndOfTrackPlacedChord(placedChord: PlacedChord): boolean {
    if (placedChord.hasNotes()) {
      return this.isEndOfTrackNote(placedChord.notes[0]);
    } else {
      return false;
    }
  }

  public isEndOfTrackNote(note: Note): boolean {
    return this.isEndOfTrackAbcNote(note.render());
  }

  private isEndOfTrackAbcNote(abcNote: string): boolean {
    return abcNote.includes(NOTE_END_OF_TRACK) && abcNote.includes(String(NOTE_END_OF_TRACK_OCTAVE));
  }

  public isOnlyEndOfTrackChords(placedChords: Array<PlacedChord>): boolean {
    let onlyEndOfTrackNotes: boolean = true;
    for (const placedChord of placedChords) {
      for (const note of placedChord.notes) {
        if (!this.isEndOfTrackNote(note)) {
          onlyEndOfTrackNotes = false;
          break;
        }
      }
      if (!onlyEndOfTrackNotes) {
        break;
      }
    }
    return onlyEndOfTrackNotes;
  }

  public addEndOfTrackNote(chords: Array<PlacedChord>): void {
    if (chords && chords.length > 0) {
      // Have a few end of track notes instead of just one
      // as a note may not be played by an unreliable synth
      chords[chords.length] = this.createLastOfTrackPlacedChord(chords.length);
      chords[chords.length] = this.createLastOfTrackPlacedChord(chords.length);
      chords[chords.length] = this.createLastOfTrackPlacedChord(chords.length);
    }
  }

  public createLastOfTrackPlacedChord(index: number): PlacedChord {
    const endNote: Note = this.createNote(index, NOTE_END_OF_TRACK, NOTE_END_OF_TRACK_OCTAVE);
    return this.createPlacedChord(index, NOTE_END_OF_TRACK_DURATION, TempoUnit.NOTE, NOTE_END_OF_TRACK_VELOCITY, DEFAULT_TONALITY_C_MAJOR, [endNote]);
  }

  public buildEndOfTrackNote(): string {
    return NOTE_END_OF_TRACK + NOTE_END_OF_TRACK_OCTAVE + CHORD_DURATION_SEPARATOR + NOTE_END_OF_TRACK_DURATION;
  }

  public getDefaultChordDuration(): Duration {
    return this.createDuration(DEFAULT_CHORD_DURATION, TempoUnit.NOTE);
  }
  public createDefaultTimeSignature(): TimeSignature {
    return new TimeSignature(DEFAULT_TIME_SIGNATURE_NUMERATOR, DEFAULT_TIME_SIGNATURE_DENOMINATOR);
  }

  public isBpmTempoUnit(duration: Duration) {
    return duration && duration.unit === TempoUnit.NOTE;
  }
/* ENHARMONICS
*/
  private allowedChromas(): Array<string> {
    const bidirectional: Array<string> = new Array();
    CHROMA_ENHARMONICS.forEach((value: string, key: string) => {
      bidirectional.push(key);
      bidirectional.push(value);
    });
    return META_CHROMAS.concat(bidirectional);
  }
/*
private allowedChromas(): Array<string> {
  return META_CHROMAS.concat(HALF_TONE_CHROMAS);
} TODO
*/

  private createChroma(value: string): Chroma {
    if (this.allowedChromas().includes(value)) {
      return new Chroma(value);
    } else {
      throw new Error('A chroma could not be instantiated witht the value ' + value);
    }
  }

  private createOctave(value: number): Octave {
    return new Octave(value);
  }

  public createDuration(duration: number, tempoUnit: TempoUnitType): Duration {
    return new Duration(duration, tempoUnit);
  }

  private createPitch(chroma: Chroma, octave: Octave): Pitch {
    return new Pitch(chroma, octave);
  }

  public createEmptyChord(index: number, duration: Duration, velocity: number, tonality: Tonality): PlacedChord {
    return new PlacedChord(index, duration, velocity, tonality);
  }

  public createSameChord(chord: PlacedChord): PlacedChord {
    const chordIndex: number = chord.index + 1;
    const sameChord: PlacedChord = this.createEmptyChord(chordIndex, chord.duration, chord.velocity, chord.tonality)
    sameChord.dottedAll = chord.dottedAll;
    chord.getNotesSortedByIndex()
    .map((note: Note) => {
      sameChord.addNote(note);
    });
    return sameChord;
  }

  public createTimeSignature(numerator: number, denominator: number): TimeSignature {
    return new TimeSignature(numerator, denominator);
  }

  // The international name of the chord is the chroma picked in the tonality
  // This chroma picked in the tonality is the first note added in the chord
  // This is valid if the chord is not reversed
  // Suffix the chord name with a minor accidental if the second note of the chord is a minor
  public getChordIntlName(placedChord: PlacedChord): string {
    const note: Note = this.getFirstChordNoteSortedByIndex(placedChord);
    // Get the chord position in the tonality
    const firstChordNote: Note = this.getFirstChordNoteSortedByIndex(placedChord);
    const firstNotePosition: number = this.getChordNotePositionInTonality(placedChord, firstChordNote);
    const secondChordNote: Note = this.getSecondChordNoteSortedByIndex(placedChord);
    const secondNotePosition: number = this.getChordNotePositionInTonality(placedChord, secondChordNote);
    // Check if the second note of the chord is a major or minor
    if (this.isMinorDegree(placedChord.tonality.range, firstNotePosition, secondNotePosition)) {
      if (this.isDiminishedDegree(placedChord.tonality.range, firstNotePosition, secondNotePosition)) {
        return note.renderChroma() + NOTE_ACCIDENTAL_MINOR + NOTE_ACCIDENTAL_DIMINISHED;
      } else {
        return note.renderChroma() + NOTE_ACCIDENTAL_MINOR;
      }
    } else {
      return note.renderChroma();
    }
  }

  private getChordNotePositionInTonality(placedChord: PlacedChord, note: Note): number {
    let tonalityChromas: Array<string> = this.getTonalityChromas(placedChord.tonality.range, placedChord.tonality.firstChroma);
    for (let position: number = 0; position < tonalityChromas.length; position++) {
      if (note.renderChroma() == tonalityChromas[position]) {
        console.log(tonalityChromas + ' : ' + note.renderChroma() + ' : ' + position);
        return position;
      }
    }
    throw new Error('The position for the placed chord note ' + note.renderChroma() + ' could not be found in the tonality ' + tonalityChromas);
  }

  private getNbHalfTonesBetweenFirstAndSecondNote(noteRange: NOTE_RANGE, firstNotePosition: number, secondNotePosition: number): number {
    let nbHalfTones: number = 0;
    const intervals: Array<number> = this.getNoteRangeIntervals(noteRange);
    for (let index: number = firstNotePosition; index < secondNotePosition; index++) {
      nbHalfTones = nbHalfTones + (intervals[index] * 2);
    }
    return nbHalfTones;
  }

  private isMajorDegree(noteRange: NOTE_RANGE, firstNotePosition: number, secondNotePosition: number): boolean {
    if (this.getNbHalfTonesBetweenFirstAndSecondNote(noteRange, firstNotePosition, secondNotePosition) == NOTE_RANGE_INTERVAL_MAJOR) {
      return true;
    } else {
      return false;
    }
  }

  private isMinorDegree(noteRange: NOTE_RANGE, firstNotePosition: number, secondNotePosition: number): boolean {
    if (this.getNbHalfTonesBetweenFirstAndSecondNote(noteRange, firstNotePosition, secondNotePosition) < NOTE_RANGE_INTERVAL_MAJOR) {
      return true;
    } else {
      return false;
    }
  }

  private isDiminishedDegree(noteRange: NOTE_RANGE, firstNotePosition: number, secondNotePosition: number): boolean {
    // Check the degree is minor
    if (this.getNbHalfTonesBetweenFirstAndSecondNote(noteRange, firstNotePosition, secondNotePosition) < NOTE_RANGE_INTERVAL_MAJOR) {
      // Consider the last interval as it is the diminished note
      const intervals: Array<number> = this.getNoteRangeIntervals(noteRange);
      if (secondNotePosition == (intervals.length - 1)) {
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  public getNoteRangeIntervals(noteRange: NOTE_RANGE): Array<number> {
    const noteRangeIntervals: Array<number> | undefined = NOTE_RANGE_INTERVALS.get(noteRange);
    if (noteRangeIntervals) {
      return noteRangeIntervals;
    } else {
      throw new Error('No intervals could be found for the note range ' + noteRange);
    }
  }

  /* TODO ENHARMONICS */
  public getTonalityChromas(noteRange: NOTE_RANGE, rangeFirstChroma: string): Array<string> {
    let tonality: Array<string> = new Array();
    const sourceScale: Array<string> = this.getSourceScale(rangeFirstChroma);
    const enharmonicScale: Array<string> = this.getEnharmonicScale(rangeFirstChroma);
    const alphaScale: Array<string> = this.getAlphaScale(rangeFirstChroma, sourceScale.length);
    const noteRangeStructure: Array<number> = this.intervalsToStructure(this.getNoteRangeIntervals(noteRange));

    let structureIndex: number = 0;
    for (let index = 0; index < sourceScale.length; index++) {
      if (noteRangeStructure[structureIndex] == index) {
        if (sourceScale[index].includes(alphaScale[structureIndex])) {
          tonality.push(sourceScale[index]);
        } else if (enharmonicScale[index].includes(alphaScale[structureIndex])) {
          tonality.push(enharmonicScale[index]);
        }
        structureIndex++;
      }
    }
    return tonality;
  }

  private getSourceScale(rangeFirstChroma: string): Array<string> {
    return this.pickContainingEnharmonics(rangeFirstChroma);
  }

  private getEnharmonicScale(rangeFirstChroma: string): Array<string> {
    const sameSoundingChroma: string = this.getChromaEnharmonic(rangeFirstChroma);
    return this.pickContainingEnharmonics(sameSoundingChroma);
  }

  private getAlphaScale(startChroma: string, length: number): Array<string> {
    var shiftedChromas: Array<string> = new Array();
    for (let i: number = 0; i < length; i++) {
      if (startChroma.includes(CHROMAS_ALPHABETICAL[i])) {
        for (let j = i; j < length + i; j++) {
          shiftedChromas.push(CHROMAS_ALPHABETICAL[j % CHROMAS_ALPHABETICAL.length]);
        }
        break;
      }
    }
    if (shiftedChromas.length == 0) {
      throw new Error('The chroma ' + startChroma + ' could not be found in the alphabetical chromas ' + CHROMAS_ALPHABETICAL);
    }
    return shiftedChromas;
  }

  // Create a new map of enharmonics from mappings with their orginal values as keys
  // so as to get a map of enharmonics containing only the reversed mappings
  private getReversedEnharmonics(): Map<string, string> {
    const reversed: Map<string, string> = new Map();
    CHROMA_ENHARMONICS.forEach((value: string, key: string) => {
      reversed.set(value, key);
    });
    return reversed;
  }

  // Add to the map of enharmonics some new mappings with their original values as keys
  // so as to get a map with the original mappings plus the reversed mappings
  private getBidirectionalEnharmonics(): Map<string, string> {
    const bidirectional: Map<string, string> = new Map();
    CHROMA_ENHARMONICS.forEach((value: string, key: string) => {
      bidirectional.set(key, value);
      bidirectional.set(value, key);
    });
    return bidirectional;
  }

  // Get the matching enharmonic from a chroma
  private getChromaEnharmonic(chroma: string): string {
    const bidirectional: Map<string, string> = this.getBidirectionalEnharmonics();
    if (bidirectional.has(chroma)) {
      const enharmonic: string | undefined = bidirectional.get(chroma);
      if (enharmonic) {
        return enharmonic;
      } else {
        throw new Error('The chroma ' + chroma + ' could not be retrieved in the enharmonics.');
      }
    } else {
      throw new Error('The chroma ' + chroma + ' could not be found in the enharmonics.');
    }
  }

  // Get the one enharmonic mappings array that contains a chroma
  // and shift the array so as to start it with the chroma
  private pickContainingEnharmonics(startChroma: string): Array<string> {
    let chromas: Array<string> = new Array();
    if (CHROMA_ENHARMONICS.has(startChroma)) {
      CHROMA_ENHARMONICS.forEach((value: string, key: string) => {
        chromas.push(key);
      });
    } else {
      const reversedEnharmonics: Map<string, string> = this.getReversedEnharmonics();
      if (reversedEnharmonics.has(startChroma)) {
        reversedEnharmonics.forEach((value: string, key: string) => {
          chromas.push(key);
        });
      } else {
        throw new Error('The chroma ' + startChroma + ' could not be found in the reversed enharmonics.');
      }
    }

    let shiftedChromas: Array<string> = new Array();
    for (let i: number = 0; i < chromas.length; i++) {
      if (startChroma == chromas[i]) {
        for (let j = i; j < chromas.length + i; j++) {
          shiftedChromas.push(chromas[j % chromas.length]);
        }
        break;
      }
    }

    return shiftedChromas;
  }

  private intervalsToStructure(noteRangeIntervals: Array<number>): Array<number> {
    let noteRangeStructure: Array<number> = new Array();
    let total: number = 0;
    for (let index: number = 0; index < noteRangeIntervals.length; index++) {
      noteRangeStructure.push(total);
      total += (2 * noteRangeIntervals[index]);
    }
    return noteRangeStructure;
  }

  private getAllTonalities(): Array<Tonality> {
    const tonalities: Array<Tonality> = new Array();
    CHROMAS_MAJOR.forEach((chroma: string) => {
      tonalities.push(new Tonality(NOTE_RANGE.MAJOR, chroma));
    });
    CHROMAS_MINOR.forEach((chroma: string) => {
      tonalities.push(new Tonality(NOTE_RANGE.MINOR_NATURAL, chroma));
    });
    return tonalities;
  }

  public createArrayShiftOnceLeft(items: Array<string>): Array<string> {
    // Make a deep copy
    let shiftedItems: Array<string> = new Array();
    items.forEach((chroma: string) => {
      shiftedItems.push(chroma);
    });

    // Shift the copy and not the original
    const item: string | undefined = shiftedItems.shift();
    if (item) {
      shiftedItems.push(item);
    } else {
      throw new Error('The array could not be shifted left');
    }
    return shiftedItems;
  }

  // Create a chromas array shifted from another one
  private createShiftedChromas(chromas: Array<string>): Array<string> {
    for (let i = 0; i < CHROMA_SHIFT_TIMES; i++) {
      chromas = this.createArrayShiftOnceLeft(chromas);
    }
    return chromas;
  }

  // Create all the shifted chromas arrays for a chord width
  public getTonalityShiftedChromas(tonalityChromas: Array<string>, chordWidth: number): Array<Array<string>> {
    const shiftedChromas: Array<Array<string>> = new Array();
    // Create shifted chromas, each starting some notes down the previous chroma
    // The number of shifted chromas is the width of the chord
    // An example for the C tonality is:
    // 'G', 'A', 'B', 'C', 'D', 'E', 'F'
    // 'E', 'F', 'G', 'A', 'B', 'C', 'D'
    // 'C', 'D', 'E', 'F', 'G', 'A', 'B'

    // Build the shifted chromas
    shiftedChromas[0] = tonalityChromas;
    for (let index = 1; index < chordWidth; index++) {
      shiftedChromas[index] = this.createShiftedChromas(shiftedChromas[index - 1]);
    }
    return shiftedChromas;
  }

  // TODO
  // public logAllTonalities(): void {
  //   this.getAllTonalities().forEach((tonality: Tonality) => {
  //     const tonalitySyllabics: Array<string> = new Array();
  //     const tonalityChromas: Array<string> = this.getTonalityChromas(tonality.range, tonality.firstChroma);
  //     const shiftedChromas: Array<Array<string>> = this.getTonalityShiftedChromas(tonalityChromas, DEFAULT_CHORD_WIDTH);

  //     let index: number = 0;
  //     tonalityChromas.forEach((tonalityChroma: string) => {
  //       const placedChord: PlacedChord = this.createPlacedChord(index, DEFAULT_CHORD_DURATION, TempoUnit.NOTE, DEFAULT_VELOCITY_MEDIUM, DEFAULT_TONALITY_C_MAJOR, notes);
  //       const chordNameIntl: string = this.getChordIntlName(placedChord);
  //       const syllabic: string = this.chordChromaLetterToChromaSyllabic(tonality.range, chordNameIntl);
  //       tonalitySyllabics.push(syllabic);
  //       index++;
  //     });
  //     console.log(tonalityChromas);
  //     console.log(tonalitySyllabics);
  //     index = 0;
  //   });
  // }

/*
  private getTonalityChromas(noteRange: NOTE_RANGE, rangeFirstChroma: string): Array<string> {
    const tonality: Array<string> = new Array();
    const noteRangeIntervals: Array<number> = this.notationService.getNoteRangeIntervals(noteRange);
    tonality.push(rangeFirstChroma);
    let chromas: Array<string> = this.notationService.selectHalfToneChromasFromFirstChroma(rangeFirstChroma);
    let index: number = chromas.indexOf(rangeFirstChroma);
    for (let i = 0; i < noteRangeIntervals.length - 1; i++) {
      for (var j = 0; j < noteRangeIntervals[i] / HALF_TONE; j++) {
        chromas = this.createArrayShiftOnceLeft(chromas);
      }
      tonality.push(chromas[index]);
    }
    return tonality;
  }
*/

}
