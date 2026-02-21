// Auto-generated IDL types for Prophit Escrow Program
export type ProphitEscrow = {
  version: "0.1.0";
  name: "prophit_escrow";
  address: "6RKKyzH7gQoQkXznvpmsFPPDBxn59LFyGJcgxbsLUCm1";
  instructions: [
    {
      name: "createArena";
      accounts: [
        { name: "arena"; isMut: true; isSigner: false },
        { name: "creator"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [
        { name: "arenaId"; type: "string" },
        { name: "stakeAmount"; type: "u64" },
        { name: "maxPlayers"; type: "u8" }
      ];
    },
    {
      name: "joinArena";
      accounts: [
        { name: "arena"; isMut: true; isSigner: false },
        { name: "player"; isMut: true; isSigner: true },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [];
    },
    {
      name: "resolveArena";
      accounts: [
        { name: "arena"; isMut: true; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true },
        { name: "winnerAccount"; isMut: true; isSigner: false },
        { name: "systemProgram"; isMut: false; isSigner: false }
      ];
      args: [{ name: "winner"; type: "publicKey" }];
    },
    {
      name: "closeArena";
      accounts: [
        { name: "arena"; isMut: true; isSigner: false },
        { name: "authority"; isMut: true; isSigner: true }
      ];
      args: [];
    }
  ];
  accounts: [
    {
      name: "Arena";
      type: {
        kind: "struct";
        fields: [
          { name: "arenaId"; type: "string" },
          { name: "creator"; type: "publicKey" },
          { name: "stakeAmount"; type: "u64" },
          { name: "maxPlayers"; type: "u8" },
          { name: "playerCount"; type: "u8" },
          { name: "status"; type: { defined: "ArenaStatus" } },
          { name: "bump"; type: "u8" },
          { name: "players"; type: { array: ["publicKey", 10] } },
          { name: "winner"; type: { option: "publicKey" } }
        ];
      };
    }
  ];
  types: [
    {
      name: "ArenaStatus";
      type: {
        kind: "enum";
        variants: [{ name: "Active" }, { name: "Completed" }];
      };
    }
  ];
  errors: [
    { code: 6000; name: "InvalidStakeAmount"; msg: "Invalid stake amount - must be greater than 0" },
    { code: 6001; name: "InvalidMaxPlayers"; msg: "Invalid max players - must be between 2 and 10" },
    { code: 6002; name: "ArenaIdTooLong"; msg: "Arena ID too long - max 64 characters" },
    { code: 6003; name: "ArenaNotActive"; msg: "Arena is not active" },
    { code: 6004; name: "ArenaFull"; msg: "Arena is full" },
    { code: 6005; name: "AlreadyJoined"; msg: "Player has already joined this arena" },
    { code: 6006; name: "UnauthorizedResolver"; msg: "Only the arena creator can resolve the arena" },
    { code: 6007; name: "WinnerNotInArena"; msg: "Winner is not a participant in this arena" },
    { code: 6008; name: "ArenaNotCompleted"; msg: "Arena must be completed before closing" }
  ];
};

export const IDL: ProphitEscrow = {
  version: "0.1.0",
  name: "prophit_escrow",
  address: "6RKKyzH7gQoQkXznvpmsFPPDBxn59LFyGJcgxbsLUCm1",
  instructions: [
    {
      name: "createArena",
      accounts: [
        { name: "arena", isMut: true, isSigner: false },
        { name: "creator", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "arenaId", type: "string" },
        { name: "stakeAmount", type: "u64" },
        { name: "maxPlayers", type: "u8" },
      ],
    },
    {
      name: "joinArena",
      accounts: [
        { name: "arena", isMut: true, isSigner: false },
        { name: "player", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "resolveArena",
      accounts: [
        { name: "arena", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "winnerAccount", isMut: true, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "winner", type: "publicKey" }],
    },
    {
      name: "closeArena",
      accounts: [
        { name: "arena", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "Arena",
      type: {
        kind: "struct",
        fields: [
          { name: "arenaId", type: "string" },
          { name: "creator", type: "publicKey" },
          { name: "stakeAmount", type: "u64" },
          { name: "maxPlayers", type: "u8" },
          { name: "playerCount", type: "u8" },
          { name: "status", type: { defined: "ArenaStatus" } },
          { name: "bump", type: "u8" },
          { name: "players", type: { array: ["publicKey", 10] } },
          { name: "winner", type: { option: "publicKey" } },
        ],
      },
    },
  ],
  types: [
    {
      name: "ArenaStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Active" }, { name: "Completed" }],
      },
    },
  ],
  errors: [
    { code: 6000, name: "InvalidStakeAmount", msg: "Invalid stake amount - must be greater than 0" },
    { code: 6001, name: "InvalidMaxPlayers", msg: "Invalid max players - must be between 2 and 10" },
    { code: 6002, name: "ArenaIdTooLong", msg: "Arena ID too long - max 64 characters" },
    { code: 6003, name: "ArenaNotActive", msg: "Arena is not active" },
    { code: 6004, name: "ArenaFull", msg: "Arena is full" },
    { code: 6005, name: "AlreadyJoined", msg: "Player has already joined this arena" },
    { code: 6006, name: "UnauthorizedResolver", msg: "Only the arena creator can resolve the arena" },
    { code: 6007, name: "WinnerNotInArena", msg: "Winner is not a participant in this arena" },
    { code: 6008, name: "ArenaNotCompleted", msg: "Arena must be completed before closing" },
  ],
};

export const PROGRAM_ID = "6RKKyzH7gQoQkXznvpmsFPPDBxn59LFyGJcgxbsLUCm1";
