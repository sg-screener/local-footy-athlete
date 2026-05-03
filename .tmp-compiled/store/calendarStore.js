"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCalendarStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const async_storage_1 = __importDefault(require("@react-native-async-storage/async-storage"));
exports.useCalendarStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
    markedDays: {},
    selectedDate: null,
    setGameDay: (date) => set((state) => ({
        markedDays: { ...state.markedDays, [date]: 'game' },
    })),
    removeGameDay: (date) => set((state) => {
        const updated = { ...state.markedDays };
        if (updated[date] === 'game')
            delete updated[date];
        return { markedDays: updated };
    }),
    setRestDay: (date) => set((state) => ({
        markedDays: { ...state.markedDays, [date]: 'rest' },
    })),
    removeRestDay: (date) => set((state) => {
        const updated = { ...state.markedDays };
        if (updated[date] === 'rest')
            delete updated[date];
        return { markedDays: updated };
    }),
    setSelectedDate: (date) => set({ selectedDate: date }),
    getGameDaysInRange: (startDate, endDate) => {
        const { markedDays } = get();
        return Object.entries(markedDays)
            .filter(([date, type]) => type === 'game' && date >= startDate && date <= endDate)
            .map(([date]) => date)
            .sort();
    },
    getNextGameDay: (fromDate) => {
        const { markedDays } = get();
        const from = fromDate || new Date().toISOString().split('T')[0];
        const gameDays = Object.entries(markedDays)
            .filter(([date, type]) => type === 'game' && date >= from)
            .map(([date]) => date)
            .sort();
        return gameDays[0] || null;
    },
    clear: () => set({ markedDays: {}, selectedDate: null }),
}), {
    name: 'calendar-storage',
    storage: (0, middleware_1.createJSONStorage)(() => async_storage_1.default),
    partialize: (state) => ({ markedDays: state.markedDays }),
}));
