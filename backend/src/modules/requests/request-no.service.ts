import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type RequestNoRow = {
  seq: number;
};

@Injectable()
export class RequestNoService {
  async next(tx: Prisma.TransactionClient, now = new Date()) {
    const dateKey = this.toDateKey(now);

    const rows = await tx.$queryRaw<RequestNoRow[]>`
      INSERT INTO request_no_counters (
        counter_date,
        seq,
        updated_at
      )
      VALUES (
        ${dateKey},
        1,
        NOW()
      )
      ON CONFLICT (counter_date)
      DO UPDATE SET
        seq = request_no_counters.seq + 1,
        updated_at = NOW()
      RETURNING seq
    `;

    const seq = Number(rows[0]?.seq ?? 1);
    return `HRB-${dateKey}-${seq.toString().padStart(4, '0')}`;
  }

  private toDateKey(now: Date) {
    const year = now.getUTCFullYear().toString();
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const date = now.getUTCDate().toString().padStart(2, '0');

    return `${year}${month}${date}`;
  }
}
