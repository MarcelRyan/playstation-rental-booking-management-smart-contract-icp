import {
    blob,
    Canister,
    ic,
    Err,
    nat64,
    bool,
    Ok,
    Opt,
    Principal,
    query,
    Record,
    Result,
    StableBTreeMap,
    text,
    update,
    Variant,
    Vec
} from 'azle';


// Interfaces used for Online Playstation Rental Booking
const RenterPayload = Record({
    id: Principal,
    name: text,
    contactInfo: text,
});
type RenterPayload = typeof RenterPayload.tsType

const GamePayload = Record({
    id: Principal,
    title: text,
    description: text,
    developers: text,
})
type GamePayload = typeof GamePayload.tsType

const PlayStationPayload = Record({
    id: Principal,
    games: Vec(Principal),
    available: bool,
});
type PlayStationPayload = typeof PlayStationPayload.tsType

const RentLogPayload = Record({
    id: Principal,
    renterId: Principal,
    playstationId: Principal,
    createdAt: nat64,
})
type RentLogPayload = typeof RentLogPayload.tsType

const Error = Variant({
    NotFound: text,
    InvalidPayload: text,
    PlayStationNotAvailable: text,
})
type Error = typeof Error.tsType

let renters = StableBTreeMap<Principal, RenterPayload>(0);
let games = StableBTreeMap<Principal, GamePayload>(1);
let playstations = StableBTreeMap<Principal, PlayStationPayload>(2);
let rentlogs = StableBTreeMap<Principal, RentLogPayload>(3);

export default Canister({

    createRenter: update([text, text], Result(RenterPayload, Error), (name, contactInfo) => {
        if (!name || !contactInfo) {
            return Err({ InvalidPayload: `Either the name or the contact info is missing!`})
        }

        const id = generateId();
        const renter: RenterPayload = {
            id,
            name,
            contactInfo
        };

        renters.insert(renter.id, renter)

        return Ok(renter);
    }),

    readRenterById: query([Principal], Result(RenterPayload, Error), (id) => {
        const renterOpt = renters.get(id);

        if ('None' in renterOpt) {
            return Err({
                NotFound: `Renter with that id doesn't exist`
            })
        }

        return Ok(renterOpt.Some);
    }),

    readRenters: query([], Vec(RenterPayload), () => {
        return renters.values();
    }),

    editRenterContactInfoById: update([Principal, text], Result(RenterPayload, Error), (id, contactInfo) => {
        const renterOpt = renters.get(id);

        if ('None' in renterOpt) {
            return Err({
                NotFound: `Renter with that id doesn't exist`
            })
        }

        const renter = renterOpt.Some;

        renter.contactInfo = contactInfo;

        return Ok(renter);
    }),

    createGame: update([text, text, text], Result(GamePayload, Error), (title, description, developers) => {
        if (!title || !description || !developers) {
            return Err({
                InvalidPayload: `You must enter all the informations needed!`
            })
        }
        
        const id = generateId()
        const game: GamePayload = {
            id,
            title,
            description,
            developers
        }

        games.insert(game.id, game)

        return Ok(game);
    }),

    readGames: query([], Vec(GamePayload), () => {
        return games.values()
    }),

    readGameById: query([Principal], Result(GamePayload, Error), (id) => {
        const gameOpt = games.get(id);

        if ('None' in gameOpt) {
            return Err({
                NotFound: `Game with that id doesn't exist`
            })
        }

        return Ok(gameOpt.Some);
    }),

    deleteGame: update([Principal], Result(GamePayload, Error), (id) => {
        const gameOpt = games.get(id);

        if ('None' in gameOpt) {
            return Err({
                NotFound: `Game with that id doesn't exist`
            })
        }

        const game = gameOpt.Some


        // Also delete the game from all the playstations that have the game
        playstations.values().forEach((playstation) => {
            const updatedPlaystation: PlayStationPayload = {
                ...playstation,
                games: playstation.games.filter(
                    (gameId) => 
                        gameId.toText() !== game.id.toText()
                )
            }

            playstations.insert(updatedPlaystation.id, updatedPlaystation)
        })

        games.remove(id)

        return Ok(game);
    }),

    createPlayStation: update([Vec(Principal)], Result(PlayStationPayload, Error), (games) => {

        const id = generateId();
        const playstation: PlayStationPayload = {
            id,
            games,
            available: true
        }

        playstations.insert(playstation.id, playstation)

        return Ok(playstation);
    }),

    readPlayStations: query([], Vec(PlayStationPayload), () => {
        return playstations.values();
    }),

    readAvailablePlaystations: query([], Vec(PlayStationPayload), () => {
        let availablePlaystations: PlayStationPayload[] = []

        playstations.values().forEach((playstation) => {
            if (playstation.available) {
                availablePlaystations = [...availablePlaystations, playstation]
            }
        })

        return availablePlaystations
    }),

    deletePlaystation: update([Principal], Result(PlayStationPayload, Error), (id) => {
        const playstationOpt = playstations.get(id);

        if ('None' in playstationOpt) {
            return Err({
                NotFound: `Playstation with that id doesn't exist`
            })
        }

        const playstation = playstationOpt.Some

        playstations.remove(id)

        return Ok(playstation);
    }),

    addGameToPlaystation: update([Principal, Vec(Principal)], Result(PlayStationPayload, Error), (id, games) => {
        const playstationOpt = playstations.get(id);

        if ('None' in playstationOpt) {
            return Err({
                NotFound: `Playstation with that id doesn't exist`
            })
        }

        const playstation = playstationOpt.Some

        let newgames = playstation.games

        games.forEach((gameId) => {
            newgames = [...newgames, gameId]
        })

        const updatedPlaystation: PlayStationPayload = {
            ...playstation,
            games: newgames
        }

        playstations.insert(updatedPlaystation.id, updatedPlaystation)

        return Ok(updatedPlaystation)
    }),

    removeGameFromPlaystation: update([Principal, Principal], Result(PlayStationPayload, Error), (playstationId, gameId) => {
        const playstationOpt = playstations.get(playstationId);

        if ('None' in playstationOpt) {
            return Err({
                NotFound: `Playstation with that id doesn't exist`
            })
        }

        const playstation = playstationOpt.Some

        const gameOpt = games.get(gameId);

        if ('None' in gameOpt) {
            return Err({
                NotFound: `Game with that id doesn't exist`
            })
        }

        const game = gameOpt.Some

        const updatedPlaystation: PlayStationPayload = {
            ...playstation,
            games: playstation.games.filter(
                (gameId) => 
                    gameId.toText() !== game.id.toText()
            )
        }

        return Ok(updatedPlaystation)
    }),

    rentPlaystation: update([Principal, Principal], Result(RentLogPayload, Error), (renterId, playstationId) => {
        const renterOpt = renters.get(renterId);

        if ('None' in renterOpt) {
            return Err({
                NotFound: `Renter with that id doesn't exist`
            })
        }

        const playstationOpt = playstations.get(playstationId);

        if ('None' in playstationOpt) {
            return Err({
                NotFound: `Playstation with that id doesn't exist`
            })
        }

        const playstation = playstationOpt.Some

        const updatedPlaystation: PlayStationPayload = {
            ...playstation,
            available: false
        }

        playstations.insert(updatedPlaystation.id, updatedPlaystation)

        const id = generateId()

        const rentLog: RentLogPayload = {
            id,
            renterId,
            playstationId,
            createdAt: ic.time()
        }

        rentlogs.insert(rentLog.id, rentLog)

        return Ok(rentLog)
    }),

    readRentLogs: query([], Vec(RentLogPayload), () => {
        return rentlogs.values()
    }),

    makePlaystationAvailable: update([Principal], Result(PlayStationPayload, Error), (id) => {
        const playstationOpt = playstations.get(id);

        if ('None' in playstationOpt) {
            return Err({
                NotFound: `Playstation with that id doesn't exist`
            })
        }

        const playstation = playstationOpt.Some

        const updatedPlaystation: PlayStationPayload = {
            ...playstation,
            available: true
        }

        playstations.insert(updatedPlaystation.id, updatedPlaystation)

        return Ok(updatedPlaystation)
    }),

    getRentLogs: query([], Vec(RentLogPayload), () => {
        return rentlogs.values()
    }),
    
    getRentLogById: query([Principal], Result(RentLogPayload, Error), (id) => {
        const rentLogOpt = rentlogs.get(id);

        if("None" in rentLogOpt) {
            return Err({
                NotFound: `Rent Log with that id doesn't exist`
            })
        }

        return Ok(rentLogOpt.Some);
    })
});

function generateId(): Principal {
    const randomBytes = new Array(29)
        .fill(0)
        .map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
