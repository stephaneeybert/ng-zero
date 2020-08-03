import { Injectable } from '@angular/core';
import { Measure } from '@app/model/measure/measure';
import { NotationService } from './notation.service';
import { PlacedChord } from '@app/model/note/placed-chord';
import { Note } from '@app/model/note/note';
import { SoundtrackService } from '@app/views/soundtrack/soundtrack.service';
import { TranslateService } from '@ngx-translate/core';
import { Soundtrack } from '@app/model/soundtrack';
import { TempoUnit } from '@app/model/tempo-unit';
import { Track } from '@app/model/track';
import { CommonService } from '@stephaneeybert/lib-core';
import { TRACK_TYPES } from './notation.service';
import { SettingsService } from '@app/views/settings/settings.service';
import { RANDOM_METHOD, DEFAULT_VELOCITY_LOUDER, DEFAULT_VELOCITY_SOFTER, CHROMAS_ALPHABETICAL } from './notation.constant ';

@Injectable({
  providedIn: 'root'
})
export class GeneratorService {

  constructor(
    private commonService: CommonService,
    private soundtrackService: SoundtrackService,
    private notationService: NotationService,
    private settingsService: SettingsService,
    private translateService: TranslateService,
  ) { }

  CHROMA_SHIFT_TIMES: number = 2;
  SIMILAR_NOTE_MIN: number = 2;

  private createNotesAndPlacedChord(octave: number, chordDuration: number, velocity: number, placedChordIndex: number, chord: Array<string>): PlacedChord {
    let noteIndex: number = 0;
    const notes: Array<Note> = chord.map((textNote: string) => {
      const note: Note = this.notationService.createNote(noteIndex, textNote, octave);
      noteIndex++;
      return note;
    })
    return this.notationService.createPlacedChord(placedChordIndex, chordDuration, TempoUnit.DUPLE, velocity, notes);
  }

  private createPlacedChords(octave: number, chordDuration: number, velocity: number, generatedChords: Array<Array<string>>): Array<PlacedChord> {
    let placedChordIndex: number = 0;
    const createdPlacedChords: Array<PlacedChord> = generatedChords
      .map((chord: Array<string>) => {
        const placedChord: PlacedChord = this.createNotesAndPlacedChord(octave, chordDuration, velocity, placedChordIndex, chord);
        placedChordIndex++;
        return placedChord;
      });
    this.notationService.addEndOfTrackNote(createdPlacedChords);
    return createdPlacedChords;
  }

  private createMeasures(generatedChords: Array<PlacedChord>): Array<Measure> {
    let measureIndex: number = 0;
    let chordIndex: number = 0;
    const measures: Array<Measure> = new Array<Measure>();
    const tempoBpm: number = this.settingsService.getSettings().generateTempoBpm;
    const timeSignatureNumerator: number = this.settingsService.getSettings().generateTimeSignatureNumerator;
    const timeSignatureDenominator: number = this.settingsService.getSettings().generateTimeSignatureDenominator;
    let measure: Measure = this.notationService.createMeasure(measureIndex, tempoBpm, timeSignatureNumerator, timeSignatureDenominator);
    measure.placedChords = new Array<PlacedChord>();
    generatedChords
      .map((placedChord: PlacedChord) => {
        if (measure.placedChords) {
          // The number of beats of the chords placed in a measure must equal the number of beats of the measure
          if (measure.getPlacedChordsNbBeats() >= measure.getNbBeats()) {
            measures.push(measure);
            measure = this.notationService.createMeasure(measureIndex, tempoBpm, timeSignatureNumerator, timeSignatureDenominator);
            measure.placedChords = new Array<PlacedChord>();
            measureIndex++;
            chordIndex = 0;
          }
          placedChord.index = chordIndex;
          chordIndex++;
          measure.placedChords.push(placedChord);
        } else {
          throw new Error('The measure placed chords array has not been instantiated.');
        }
      });
    return measures;
  }

  public generateSoundtrack(): Soundtrack {
    const soundtrack: Soundtrack = this.soundtrackService.createSoundtrack(this.assignNewName());

    const randomMethod: RANDOM_METHOD = this.settingsService.getSettings().generateMethod;

    const octave: number = this.settingsService.getSettings().generateNoteOctave;
    const chordDuration: number = this.settingsService.getSettings().generateChordDuration;

    const harmonyChords: Array<Array<string>> = this.generateHarmonyChords(randomMethod);
    const melodyChords: Array<Array<string>> = this.generateMelodyChords(harmonyChords, randomMethod);

    const melodyTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(octave, chordDuration, DEFAULT_VELOCITY_LOUDER, melodyChords)));
    melodyTrack.name = this.getTrackName(TRACK_TYPES.MELODY);

    const generateHarmony: boolean = this.settingsService.getSettings().generateHarmony;
    if (generateHarmony) {
      const harmonyTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(octave, chordDuration, DEFAULT_VELOCITY_SOFTER, harmonyChords)));
      harmonyTrack.name = this.getTrackName(TRACK_TYPES.HARMONY);
      harmonyTrack.displayChordNames = true;
    }

    const generateDrums: boolean = this.settingsService.getSettings().generateDrums;
    if (generateDrums) {
      const drumsChords: Array<Array<string>> = [[]];
      const drumsTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(octave, chordDuration, DEFAULT_VELOCITY_SOFTER, drumsChords)));
      drumsTrack.name = this.getTrackName(TRACK_TYPES.DRUMS);
      drumsTrack.displayChordNames = true;
    }

    const generateBass: boolean = this.settingsService.getSettings().generateBass;
    if (generateBass) {
      const bassChords: Array<Array<string>> = [[]];
      const bassTrack: Track = soundtrack.addTrack(this.createMeasures(this.createPlacedChords(octave, chordDuration, DEFAULT_VELOCITY_SOFTER, bassChords)));
      bassTrack.name = this.getTrackName(TRACK_TYPES.BASS);
      bassTrack.displayChordNames = true;
    }

    this.soundtrackService.storeSoundtrack(soundtrack);
    return soundtrack;
  }

  private getTrackName(trackType: string): string {
    return this.translateService.instant('music.notation.track.' + trackType);
  }

  private assignNewName(): string {
    return this.translateService.instant('soundtracks.assignedName') + '_' + this.commonService.getRandomString(4);
  }

  private createArrayShiftOnceLeft(items: Array<string>): Array<string> {
    // Make a deep copy
    let shiftedItems: Array<string> = new Array();
    items.map((chroma: string) => {
      shiftedItems.push(chroma);
    })

    // Shift the copy and not the original
    const item: string | undefined = shiftedItems.shift();
    shiftedItems.push(item!);
    return shiftedItems;
  }

  private createArrayShiftOnceRight(items: Array<string>): Array<string> {
    // Make a deep copy
    let shiftedItems: Array<string> = new Array();
    items.map((chroma: string) => {
      shiftedItems.push(chroma);
    })

    // Shift the copy and not the original
    const item: string | undefined = shiftedItems.pop();
    shiftedItems.unshift(item!);
    return shiftedItems;
  }

  // Create a chromas array shifted from another one
  private createShiftedChromas(chromas: Array<string>): Array<string> {
    for (var i = 0; i < this.CHROMA_SHIFT_TIMES; i++) {
      chromas = this.createArrayShiftOnceLeft(chromas);
    }
    return chromas;
  }

  // Create all the shifted chromas arrays for a chord width
  private createAllShiftedChromas(): Array<Array<string>> {
    const shiftedChromas: Array<Array<string>> = new Array();
    // Create shifted chromas, each starting some notes down the previous chroma
    // The number of shifted chromas is the width of the chord
    //  Do Re.m  Mi.m  Fa  Sol  La.m  Si-
    // 'C', 'D', 'E', 'F', 'G', 'A', 'B'
    // 'E', 'F', 'G', 'A', 'B', 'C', 'D'
    // 'G', 'A', 'B', 'C', 'D', 'E', 'F'

    // Build the shifted chromas
    shiftedChromas[0] = CHROMAS_ALPHABETICAL;
    const chordWidth: number = this.settingsService.getSettings().generateChordWidth;
    for (let index = 1; index < chordWidth; index++) {
      shiftedChromas[index] = this.createShiftedChromas(shiftedChromas[index - 1]);
    }
    return shiftedChromas;
  }

  // Check if the chord shares a minimum number of notes with its previous chord
  private isSimilarToPrevious(previousChord: Array<string>, chord: Array<string>): boolean {
    let nbSameNotes: number = 0;
    for (var i = 0; i < this.settingsService.getSettings().generateChordWidth; i++) {
      if (previousChord.includes(chord[i])) {
        nbSameNotes++;
      }
    }
    return (nbSameNotes >= this.SIMILAR_NOTE_MIN);
  }

  private createShiftedChord(chord: Array<string>): Array<string> {
    return this.createArrayShiftOnceRight(chord);
  }

  // The randomised pick between a source chord note or an inpassing note can be tuned by a setting
  private fromInpassingNote(): boolean {
    const inpassingNote: number = this.settingsService.getSettings().generateInpassingNote;
    if (inpassingNote > 0) {
      const randomInpassingnote: number = this.commonService.getRandomIntegerBetween(0, 100);
      if (randomInpassingnote < inpassingNote) {
        return true;
      }
    }
    return false;
  }

  private getNearNotes(harmonyChord: Array<string>, firstMelodyNote: string): Array<string> {
    const nearNotes: Array<string> = new Array<string>();
    let chromas: Array<string> = CHROMAS_ALPHABETICAL;
    const firstMelodyNoteIndex: number = CHROMAS_ALPHABETICAL.indexOf(firstMelodyNote);
    for (let chromaIndex: number = 0; chromaIndex < CHROMAS_ALPHABETICAL.length; chromaIndex++) {
      chromas = this.createArrayShiftOnceLeft(chromas);
      if (!harmonyChord.includes(chromas[firstMelodyNoteIndex])) {
        nearNotes.push(chromas[firstMelodyNoteIndex]);
      } else {
        break;
      }
    }
    chromas = CHROMAS_ALPHABETICAL;
    for (let chromaIndex: number = 0; chromaIndex < CHROMAS_ALPHABETICAL.length; chromaIndex++) {
      chromas = this.createArrayShiftOnceRight(chromas);
      if (!harmonyChord.includes(chromas[firstMelodyNoteIndex])) {
        nearNotes.push(chromas[firstMelodyNoteIndex]);
      } else {
        break;
      }
    }
    return nearNotes;
  }

  private getInpassingNote(harmonyChord: Array<string>, firstMelodyNote: string): string {
    // Randomly pick a note from the near ones
    const nearNotes: Array<string> = this.getNearNotes(harmonyChord, firstMelodyNote);
    const nearNoteIndex: number = this.commonService.getRandomIntegerBetween(0, nearNotes.length - 1);
    return harmonyChord[nearNoteIndex];
  }

  private generateMelodyChords(harmonyChords: Array<Array<string>>, randomMethod: number): Array<Array<string>> {
    const melodyChords: Array<Array<string>> = new Array();
    harmonyChords.forEach((harmonyChord: Array<string>) => {
      const melodyChord: Array<string> = new Array();
      if (RANDOM_METHOD.HARMONY_BASE == randomMethod) {
        // For each source chord of the harmony track, there are two single note chords of half duration in the melody track
        // The first note is one of the source chord, and the second note is also a note from the same source chord or an inpassing note
        // An inpassing note is one that is not in the source chord but that is between the previous note and another note of the source chord even if of a another octave
        // So an inpassing note cannot be followed by another inpassing note, but a source chord note can be followed by another source chord note

        // Get one of the source chord notes
        const melodyChord: Array<string> = new Array();
        const chordWidth: number = this.settingsService.getSettings().generateChordWidth;
        const firstNoteIndex: number = this.commonService.getRandomIntegerBetween(0, chordWidth - 1);
        const firstMelodyNote: string = harmonyChord[firstNoteIndex];
        // TODO halve the duration
        melodyChord.push(firstMelodyNote);
        melodyChords.push(melodyChord);
        if (this.fromInpassingNote()) {
          const inpassingNote: string = this.getInpassingNote(harmonyChord, firstMelodyNote);
          // TODO halve the duration
          melodyChord.push(inpassingNote);
          melodyChords.push(melodyChord);
        } else {
          // Get one of the source chord notes even the already picked one
          const secondNoteIndex: number = this.commonService.getRandomIntegerBetween(0, chordWidth);
          const secondMelodyNote: string = harmonyChord[secondNoteIndex];
          if (secondMelodyNote != firstMelodyNote) {
            // TODO halve the duration
            melodyChord.push(secondMelodyNote);
            melodyChords.push(melodyChord);
          } else {
            // If the second note is the same as the fisrt one then have only one chord
            // but with a duration that is twice as long
            // TODO double the previously halved duration
            melodyChord.push(secondMelodyNote);
            melodyChords.push(melodyChord);
          }
        }
      } else {
        // Get the first note of the source chord notes
        const melodyNote: string = harmonyChord[0];
        melodyChord.push(melodyNote);
        melodyChords.push(melodyChord);
      }
    });
    return melodyChords;
  }

  private generateHarmonyChords(randomMethod: number): Array<Array<string>> {
    const chords: Array<Array<string>> = new Array();
    let previousChord: Array<string> = new Array();
    let previousChromaNoteIndex: number = 0;
    let nbAddedChord: number = 0;

    const shiftedChromas: Array<Array<string>> = this.createAllShiftedChromas();

    while (nbAddedChord < this.settingsService.getSettings().generateNbChords) {
      const chord: Array<string> = new Array();

      // For each randomly picked chroma, add its chord to an array
      const chromaNoteIndex: number = (nbAddedChord === 0) ? 0 : this.randomlyPickChroma(previousChromaNoteIndex, randomMethod);
      for (let noteIndex = 0; noteIndex < this.settingsService.getSettings().generateChordWidth; noteIndex++) {
        chord.push(shiftedChromas[noteIndex][chromaNoteIndex]);
      }

      // Consider a chord only if it is similar to its previous one
      if (chords.length === 0 || this.isSimilarToPrevious(previousChord, chord)) {
        previousChromaNoteIndex = chromaNoteIndex;
        previousChord = chord;
        // Add twice the same chord
        chords.push(chord);
        nbAddedChord++;
        chords.push(chord); // TODO Do we still double the notes ?
        nbAddedChord++;
      } else {
        // TODO Do we still reverse the notes ?
        // If the current chord is too dissimilar from its previous one
        // then create a chord from a reversing of the previous one
        if (this.settingsService.getSettings().generateReverseDissimilarChord) {
          const slidedChord: Array<string> = this.createShiftedChord(previousChord);
          chords.push(chord);
          nbAddedChord++;
        }
      }
    }
    return chords;
  }

  private randomlyPickChroma(chromaIndex: number, randomMethod: number): number {
    if (RANDOM_METHOD.BASE == randomMethod) {
      return this.randomlyPickChromaFromBaseChromas(chromaIndex);
    } else if (RANDOM_METHOD.BONUS_TABLE == randomMethod) {
      return this.randomlyPickChromaFromChromasPool(chromaIndex);
    } else if (RANDOM_METHOD.HARMONY_BASE == randomMethod) {
      return this.randomlyPickChromaFromChromasPool(chromaIndex);
    } else {
      throw new Error('The selected generation method does not exist.');
    }
  }

  private randomlyPickChromaFromBaseChromas(chromaIndex: number): number {
    return this.commonService.getRandomIntegerBetweenAndExcept(0, CHROMAS_ALPHABETICAL.length - 1, [ chromaIndex ])
  }

  // The table of bonus per chroma
  // For a given chroma there is a series of bonus numbers
  // A bonus represents the level of harmony between a chroma and its following chroma
  // The chromas are indexed in the chromas alphabetical array
  private getBonusTable(): Array<Array<number>> {
    const matrix: Array<Array<number>> = [
    //  C  D  E  F  G  A  B
      [ 30, 0, 15, 5, 5, 10, 0 ],
      [ 0, 30, 0, 10, 0, 5, 10 ],
      [ 15, 0, 30, 0, 10, 0, 0 ],
      [ 5, 10, 0, 30, 0, 15, 0 ],
      [ 5, 0, 10, 0, 30, 0, 10 ],
      [ 10, 5, 0, 15, 0, 30, 0 ],
      [ 0, 10, 0, 0, 10, 0, 30 ]
    ];
    return matrix;
  }

  private getChromaBonuses(chromaIndex: number): Array<number> {
    return this.getBonusTable()[chromaIndex];
  }

  private buildUpChromasPoolFromBonuses(chromaIndex: number): Array<number> {
    const RANDOMLINESS: number = 0;
    const MIN_BONUS: number = 3;
    const chromaBonuses: Array<number> = this.getChromaBonuses(chromaIndex);
    let currentChromaIndex: number = 0;
    const chromasPool: Array<number> = new Array();
    chromaBonuses.forEach((chromaBonus: number) => {
      // If a minimum bonus is specified then do not consider the chromas that have a lower bonus
      if ((MIN_BONUS > 0 && chromaBonus >= MIN_BONUS) || 0 === MIN_BONUS) {
        // The higher the more random
        chromaBonus += RANDOMLINESS;
        for (let nb = 0; nb < chromaBonus; nb++) {
          chromasPool.push(currentChromaIndex);
        }
      }
      currentChromaIndex++;
    });
    return chromasPool;
  }

  private randomlyPickChromaFromChromasPool(chromaIndex: number): number {
    const chromasPool: Array<number> = this.buildUpChromasPoolFromBonuses(chromaIndex);
    const randomChromaIndex: number = this.commonService.getRandomIntegerBetween(0, chromasPool.length - 1);
    return chromasPool[randomChromaIndex];
  }

}
