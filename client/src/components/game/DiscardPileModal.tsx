import React from 'react';
import { Modal } from '../ui/Modal';
import { Card } from './Card';
import { Card as CardType, ClientPlayerState } from '../../types';

interface DiscardPileModalProps {
  isOpen: boolean;
  onClose: () => void;
  discardPile: CardType[];
  players: ClientPlayerState[];
}

export function DiscardPileModal({ isOpen, onClose, discardPile, players }: DiscardPileModalProps) {
  const reversed = [...discardPile].reverse();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Discard Pile · ${discardPile.length} cards`} size="md">
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto py-1">
        {reversed.map((card, idx) => {
          const discarder = card.discardedBy
            ? players.find(p => p.userId === card.discardedBy)?.username ?? 'Unknown'
            : null;

          return (
            <div key={card.id} className="relative flex justify-center">
              <Card card={card} size="sm" />
              {discarder && (
                <span className="absolute left-1 top-1 rounded-full bg-black/80 text-[9px] text-slate-200 px-1.5 py-0.5 leading-none">
                  {discarder}
                </span>
              )}
              {idx === 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-neon-green text-dark-bg text-[8px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  TOP
                </span>
              )}
            </div>
          );
        })}
        {discardPile.length === 0 && (
          <div className="col-span-4 sm:col-span-5 text-center text-dark-muted py-8 text-sm">
            Discard pile is empty
          </div>
        )}
      </div>
    </Modal>
  );
}
