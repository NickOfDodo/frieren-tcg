import { CharacterData } from "../characterData";
import { ubelDeck } from "../../../decks/UbelDeck";
import Stats from "../../../stats";
import { StatsEnum } from "../../../stats";
import Game from "../../../game";
import Card from "../../../card";
import Rolls from "../../../util/rolls";
import Character from "../../../character";
import { CharacterName } from "../../metadata/CharacterName";
import { MessageCache } from "../../../../tcgChatInteractions/messageCache";
import { TCGThread } from "../../../../tcgChatInteractions/sendGameMessage";
import { CharacterEmoji } from "../../../formatting/emojis";

const PIERCE_FACTOR = 0.5;

const ubelStats = new Stats({
  [StatsEnum.HP]: 90.0,
  [StatsEnum.ATK]: 12.0,
  [StatsEnum.DEF]: 8.0,
  [StatsEnum.SPD]: 14.0,
  [StatsEnum.Ability]: 0.0,
});

export const Ubel = new CharacterData({
  name: CharacterName.Ubel,
  cosmetic: {
    pronouns: {
      possessive: "her",
      reflexive: "herself",
    },
    emoji: CharacterEmoji.UBEL,
    color: 0x3c5502,
    imageUrl:
      "https://cdn.discordapp.com/attachments/1147147425878921240/1361843328596840558/Xdt0V0dFkFFUIynaHzeRl4CDSpdXIIyx.png?ex=68003aef&is=67fee96f&hm=272a9e1a94f2bae706b259a9cf6e7b19eb135bab69b8bfff26c343be7744c318&",
  },
  stats: ubelStats,
  cards: ubelDeck,
  ability: {
    abilityName: "Battle-crazed weirdo",
    abilityEffectString: `Übel's attack ignore ${PIERCE_FACTOR * 100}% the opponent's defense stats, but are blocked by defensive moves.`,
    
    // same turn surehit effect changes
    abilityAfterOpponentsMoveEffect: function(
      game: Game,
      characterIndex: number,
      messageCache: MessageCache,
      card: Card
    ) {
      const character = game.getCharacter(characterIndex);
      const opponent = game.getCharacter(1-characterIndex);
      const effects = character.timedEffects.map(effect => effect.name);
      console.log(`ongoing effects: ${effects}`);
      switch (card.cardMetadata.nature) {
        case "Attack":
          if (!effects.find(effectName => effectName === "Recompose")){
            character.additionalMetadata.sureHit = "sureHit";
            messageCache.push(`${opponent.name} is wide-open!`, TCGThread.Gameroom);
          }
          break;
        case "Defense":
          character.additionalMetadata.sureHit = "sureMiss";
          messageCache.push(`${character.name} can't cut through this!`, TCGThread.Gameroom);
          break;
        case "Default":
          if (!effects.find(effectName => effectName === "Recompose") && !effects.find(effectName => effectName === "Rushdown")){
            character.additionalMetadata.sureHit = "regular";
          };
      }
    },

    // new turn surehit effect changes
    abilityStartOfTurnEffect: function(
      game,
      characterIndex,
      messageCache,
    ) {
      const character = game.getCharacter(characterIndex);
      const effects = character.timedEffects.map(effect => effect.name);
      
      if (effects.find(effectName => effectName === "Sorganeil")||effects.find(effectName => effectName === "Rushdown")){
        character.additionalMetadata.sureHit = "sureHit";
      } else if (effects.find(effectName => effectName === "Recompose")){
        character.additionalMetadata.sureHit = "sureMiss";
      } else {
        switch (character.additionalMetadata.sureHit) {
          case "sureHit":
            if (game.additionalMetadata.lastUsedCards[1-characterIndex].cardMetadata.nature != "Attack") {
              character.additionalMetadata.sureHit = "regular"
            };
            break;
          case "sureMiss":
            character.additionalMetadata.sureHit = "regular";
            break;
          default:
            // do nothing
        }
      }
      console.log(`Current sure hit status ${character.additionalMetadata.sureHit}`);
    },

    // attacks should potentially fail
    abilityCardWrapper: function (
      game: Game,
      characterIndex: number,
      messageCache: MessageCache,
      card: Card
    ) {
      function missAttack(
        character: Character,
        messageCache: MessageCache,
        card: Card
      ) {
        const hpCost = card.hpCost;
        character.adjustStat(-hpCost, StatsEnum.HP);
        messageCache.push("The attack misses!", TCGThread.Gameroom);
      }

      const character = game.getCharacter(characterIndex);
      const failureRate = card.cardMetadata.ubelFailureRate;

      switch (character.additionalMetadata.sureHit) {
        case "sureHit":
          card.cardAction?.(game, characterIndex, messageCache);
          break;
        case "sureMiss":
          if (!failureRate) {
            card.cardAction?.(game, characterIndex, messageCache);
          } else {
            missAttack(character, messageCache, card);
          }
          break;
        case "regular":
          if (!failureRate) {
            card.cardAction?.(game, characterIndex, messageCache);
          } else {
            const luckRoll = Rolls.rollD100();
            messageCache.push(
              `## **Missing chances:** ${failureRate}%`,
              TCGThread.Gameroom
            );
            messageCache.push(`# Luck roll: ${luckRoll}`, TCGThread.Gameroom);
            if (luckRoll < failureRate) {
              missAttack(character, messageCache, card);
            } else {
              messageCache.push("The attack connects!", TCGThread.Gameroom);
              card.cardAction?.(game, characterIndex, messageCache);
            }
          }
      }
    },
  },
  additionalMetadata: {
    attackedThisTurn: false,
    timedEffectAttackedThisTurn: false,
    accessToDefaultCardOptions: true,
    manaSuppressed: false,
    pierceFactor: PIERCE_FACTOR,
    sureHit: "regular",
  },
});
