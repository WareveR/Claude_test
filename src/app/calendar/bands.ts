/**
 * The days' row every calendar view has between its options bar and its content (the day, Monday
 * to Sunday, or the weekday letters over the year): one size and weight in all of them.
 */
export const DAYS_ROW = "py-1.5 text-sm font-bold lg:text-base";

/**
 * Where that row sticks on a page that scrolls: just under the options bar, so it stays in sight
 * until the view itself has scrolled past. One more swipe down at the view's end hides it (see
 * useDaysRowAtEnd).
 */
export const DAYS_ROW_STICKY = "days-row sticky top-[var(--view-nav-h,0px)] z-15";
