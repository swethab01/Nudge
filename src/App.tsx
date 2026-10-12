
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

type ReminderId = "water" | "meal" | "posture" | "eyes" | "break";
type Page = "home" | "settings" | "progress";
type PermissionStatus = NotificationPermission | "unsupported";

type Settings = Record<ReminderId, boolean>;

type Intervals = {
  water: string;
  posture: string;
  eyes: string;
  break: string;
};

type ActiveReminder = {
  id: ReminderId;
  title: string;
  message: string;
};

const reminders: {
  id: ReminderId;
  emoji: string;
  title: string;
  description: string;
}[] = [
    {
      id: "water",
      emoji: "💧",
      title: "Drink Water",
      description: "Stay hydrated throughout your day.",
    },
    {
      id: "meal",
      emoji: "🍎",
      title: "Meal Time",
      description: "Remember to eat your meals on time.",
    },
    {
      id: "posture",
      emoji: "🪑",
      title: "Check Your Posture",
      description: "Sit comfortably and keep your back straight.",
    },
    {
      id: "eyes",
      emoji: "👀",
      title: "Eye Rest",
      description: "Give your eyes a short break from the screen.",
    },
    {
      id: "break",
      emoji: "🌿",
      title: "Take a Break",
      description: "Pause your work and stretch a little.",
    },
  ];

const defaultSettings: Settings = {
  water: true,
  meal: true,
  posture: true,
  eyes: true,
  break: true,
};

const defaultIntervals: Intervals = {
  water: "60",
  posture: "45",
  eyes: "20",
  break: "60",
};

const defaultMealTimes = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "20:00",
};

type MealTimes = typeof defaultMealTimes;

function loadSavedValue<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);

    if (saved === null) {
      return fallback;
    }

    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

function App() {
  const [activePage, setActivePage] = useState<Page>("home");
  const [completed, setCompleted] = useState<ReminderId[]>([]);
  const [activeReminder, setActiveReminder] =
    useState<ActiveReminder | null>(null);

  const [settings, setSettings] = useState<Settings>(() =>
    loadSavedValue("nudge-settings", defaultSettings)
  );

  const [intervals, setIntervals] = useState<Intervals>(() =>
    loadSavedValue("nudge-intervals", defaultIntervals)
  );

  const [mealTimes, setMealTimes] = useState<MealTimes>(() =>
    loadSavedValue("nudge-meal-times", defaultMealTimes)
  );

  const [notificationPermission, setNotificationPermission] =
    useState<PermissionStatus>(() =>
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission
    );

  // Keep snooze timers independent for each reminder.
  const snoozeTimers = useRef<Partial<Record<ReminderId, number>>>({});

  // Save preferences automatically whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem("nudge-settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save reminder settings:", error);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem("nudge-intervals", JSON.stringify(intervals));
    } catch (error) {
      console.error("Could not save reminder intervals:", error);
    }
  }, [intervals]);

  useEffect(() => {
    try {
      localStorage.setItem("nudge-meal-times", JSON.stringify(mealTimes));
    } catch (error) {
      console.error("Could not save meal times:", error);
    }
  }, [mealTimes]);

  // Clean up pending snooze timers when Nudge unmounts.
  useEffect(() => {
    return () => {
      Object.values(snoozeTimers.current).forEach((timer) => {
        if (timer !== undefined) {
          window.clearTimeout(timer);
        }
      });
    };
  }, []);

  const completedCount = completed.length;

  function toggleReminder(id: ReminderId) {
    setSettings((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  }

  function markAsDone(id: ReminderId) {
    setCompleted((previous) =>
      previous.includes(id) ? previous : [...previous, id]
    );
  }

  function resetProgress() {
    setCompleted([]);
  }

  function resetSettings() {
    setSettings({ ...defaultSettings });
    setIntervals({ ...defaultIntervals });
    setMealTimes({ ...defaultMealTimes });
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission("default");
    }
  }

  const sendNotification = useCallback(
    (title: string, message: string) => {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, { body: message });
        } catch (error) {
          console.error("Could not show desktop notification:", error);
        }
      }
    },
    []
  );

  // Show the in-app reminder and the Windows desktop notification.
  const showReminder = useCallback(
    (reminder: ActiveReminder) => {
      setActiveReminder(reminder);
      sendNotification(reminder.title, reminder.message);
    },
    [sendNotification]
  );

  // Dismiss the current reminder and mark the activity completed.
  function dismissReminder() {
    if (!activeReminder) return;

    const id = activeReminder.id;
    const pendingTimer = snoozeTimers.current[id];

    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      delete snoozeTimers.current[id];
    }

    markAsDone(id);
    setActiveReminder(null);
  }

  // Snooze only this reminder for 10 minutes.
  // Other reminder schedules remain unchanged.
  function snoozeReminder() {
    if (!activeReminder) return;

    const reminder = activeReminder;
    const id = reminder.id;
    const pendingTimer = snoozeTimers.current[id];

    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
    }

    setActiveReminder(null);

    snoozeTimers.current[id] = window.setTimeout(() => {
      delete snoozeTimers.current[id];

      if (settings[id]) {
        showReminder(reminder);
      }
    }, 10 * 60 * 1000);
  }

  // Test the operating system's desktop notification.
  async function testNotification() {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }

    let permission = Notification.permission;

    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
        setNotificationPermission(permission);
      } catch {
        setNotificationPermission("default");
        return;
      }
    }

    if (permission === "granted") {
      sendNotification(
        "Nudge is working! 🌿",
        "Your desktop wellness reminders are ready."
      );
    }
  }

  // Schedule recurring reminders and daily meal reminders.
  useEffect(() => {
    if (
      notificationPermission !== "granted" ||
      typeof Notification === "undefined"
    ) {
      return;
    }

    const intervalTimers: number[] = [];
    const mealTimers: number[] = [];

    const intervalMessages: Record<
      Exclude<ReminderId, "meal">,
      { title: string; message: string }
    > = {
      water: {
        title: "Time to drink water 💧",
        message: "Take a moment to drink some water.",
      },
      posture: {
        title: "Check your posture 🪑",
        message: "Sit comfortably and straighten your back.",
      },
      eyes: {
        title: "Give your eyes a rest 👀",
        message: "Look away from your screen for a little while.",
      },
      break: {
        title: "Time for a break 🌿",
        message: "Stand up, stretch, and relax for a moment.",
      },
    };

    (["water", "posture", "eyes", "break"] as const).forEach((id) => {
      if (!settings[id]) return;

      const minutes = Number(intervals[id]);

      // Ignore invalid intervals.
      if (!Number.isFinite(minutes) || minutes <= 0) return;

      const timer = window.setInterval(() => {
        const reminder = intervalMessages[id];

        showReminder({
          id,
          title: reminder.title,
          message: reminder.message,
        });
      }, minutes * 60 * 1000);

      intervalTimers.push(timer);
    });

    const mealLabels = {
      breakfast: "Breakfast 🍳",
      lunch: "Lunch 🍎",
      dinner: "Dinner 🍽️",
    } as const;

    (Object.keys(mealTimes) as (keyof MealTimes)[]).forEach((meal) => {
      if (!settings.meal) return;

      const [hours, minutes] = mealTimes[meal].split(":").map(Number);

      if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
      ) {
        return;
      }

      const now = new Date();
      const nextMeal = new Date();

      nextMeal.setHours(hours, minutes, 0, 0);

      if (nextMeal.getTime() <= now.getTime()) {
        nextMeal.setDate(nextMeal.getDate() + 1);
      }

      const delay = nextMeal.getTime() - now.getTime();

      const timer = window.setTimeout(() => {
        showReminder({
          id: "meal",
          title: `It's ${mealLabels[meal]} time!`,
          message: "Take a break and enjoy your meal.",
        });

        const dailyTimer = window.setInterval(() => {
          showReminder({
            id: "meal",
            title: `It's ${mealLabels[meal]} time!`,
            message: "Take a break and enjoy your meal.",
          });
        }, 24 * 60 * 60 * 1000);

        mealTimers.push(dailyTimer);
      }, delay);

      mealTimers.push(timer);
    });

    return () => {
      intervalTimers.forEach((timer) => window.clearInterval(timer));

      mealTimers.forEach((timer) => {
        window.clearTimeout(timer);
        window.clearInterval(timer);
      });
    };
  }, [notificationPermission, settings, intervals, mealTimes, showReminder]);

  return (
    <div className="nudge-app">
      <header className="header">
        <div>
          <h1>Nudge</h1>
          <p>Your little companion for a healthier day.</p>
        </div>
      </header>

      <nav className="page-nav" aria-label="Main navigation">
        <button
          className={`nav-button ${activePage === "home" ? "active" : ""}`}
          onClick={() => setActivePage("home")}
        >
          🏠 Home
        </button>

        <button
          className={`nav-button ${activePage === "settings" ? "active" : ""}`}
          onClick={() => setActivePage("settings")}
        >
          ⚙️ Settings
        </button>

        <button
          className={`nav-button ${activePage === "progress" ? "active" : ""}`}
          onClick={() => setActivePage("progress")}
        >
          📊 Progress
        </button>
      </nav>

      <main className="main">
        {activePage === "home" && (
          <section>
            <div className="page-heading">
              <h2>Good day! 👋</h2>
              <p>
                Small reminders can make a big difference.
                Take care of yourself today.
              </p>
            </div>

            <div className="progress-summary">
              <h3>Today's Progress</h3>
              <p>
                {completedCount} of {reminders.length} activities completed
              </p>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(completedCount / reminders.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {completedCount === reminders.length && (
              <p className="success-message">
                🎉 Amazing! You've completed all your activities today.
              </p>
            )}

            <div className="reminder-grid">
              {reminders.map((reminder) => {
                const isCompleted = completed.includes(reminder.id);
                const isEnabled = settings[reminder.id];

                return (
                  <article className="reminder-card" key={reminder.id}>
                    <div className="reminder-emoji">{reminder.emoji}</div>
                    <h3>{reminder.title}</h3>
                    <p>{reminder.description}</p>

                    {!isEnabled && (
                      <p className="status-text">
                        Reminder is turned off in Settings.
                      </p>
                    )}

                    {isCompleted ? (
                      <button className="done-button" disabled>
                        ✓ Completed
                      </button>
                    ) : (
                      <button
                        className="done-button"
                        onClick={() => markAsDone(reminder.id)}
                      >
                        Mark as done
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            <button className="secondary-button" onClick={resetProgress}>
              Reset today's progress
            </button>
          </section>
        )}

        {activePage === "settings" && (
          <section>
            <div className="page-heading">
              <h2>Settings ⚙️</h2>
              <p>Manage your reminders and preferred timings.</p>
            </div>

            <div className="setting-card notification-setting">
              <h3>Desktop Notifications 🔔</h3>
              <p>
                Allow Nudge to show reminder notifications on your computer.
              </p>

              {notificationPermission === "granted" ? (
                <p className="notification-status">
                  ✓ Notifications enabled
                </p>
              ) : notificationPermission === "denied" ? (
                <p className="notification-status">
                  Notifications are blocked. Allow them in your computer's
                  notification settings.
                </p>
              ) : notificationPermission === "unsupported" ? (
                <p className="notification-status">
                  This environment does not support notifications.
                </p>
              ) : (
                <button className="done-button" onClick={enableNotifications}>
                  Enable Notifications
                </button>
              )}

              {notificationPermission !== "unsupported" && (
                <button
                  className="secondary-button"
                  onClick={testNotification}
                  style={{ marginTop: "12px" }}
                >
                  🔔 Test Notification
                </button>
              )}
            </div>

            <div className="settings-section">
              {reminders.map((reminder) => (
                <article className="setting-card" key={reminder.id}>
                  <div className="setting-top">
                    <div>
                      <h3 className="setting-name">
                        <span className="setting-emoji">{reminder.emoji}</span>
                        {reminder.title}
                      </h3>
                      <p>{reminder.description}</p>
                    </div>

                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings[reminder.id]}
                        onChange={() => toggleReminder(reminder.id)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  {settings[reminder.id] && reminder.id === "meal" && (
                    <div className="meal-times">
                      <label className="field-label">
                        Breakfast
                        <input
                          type="time"
                          value={mealTimes.breakfast}
                          onChange={(event) =>
                            setMealTimes((previous) => ({
                              ...previous,
                              breakfast: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="field-label">
                        Lunch
                        <input
                          type="time"
                          value={mealTimes.lunch}
                          onChange={(event) =>
                            setMealTimes((previous) => ({
                              ...previous,
                              lunch: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="field-label">
                        Dinner
                        <input
                          type="time"
                          value={mealTimes.dinner}
                          onChange={(event) =>
                            setMealTimes((previous) => ({
                              ...previous,
                              dinner: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}

                  {settings[reminder.id] && reminder.id !== "meal" && (
                    <label className="field-label interval-field">
                      Remind me every
                      <select
                        value={intervals[reminder.id]}
                        onChange={(event) =>
                          setIntervals((previous) => ({
                            ...previous,
                            [reminder.id]: event.target.value,
                          }))
                        }
                      >
                        {(reminder.id === "water"
                          ? ["30", "45", "60", "90", "120"]
                          : reminder.id === "posture"
                            ? ["20", "30", "45", "60"]
                            : reminder.id === "eyes"
                              ? ["10", "20", "30", "45"]
                              : ["30", "45", "60", "90"]
                        ).map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} minutes
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </article>
              ))}
            </div>

            <button className="secondary-button" onClick={resetSettings}>
              Reset settings to default
            </button>

            <p className="settings-note">
              Your reminder preferences are saved automatically on this device.
              Notifications run while Nudge is running, including when its
              window is hidden.
            </p>
          </section>
        )}

        {activePage === "progress" && (
          <section>
            <div className="page-heading">
              <h2>Your Progress 📊</h2>
              <p>Check the activities you've completed today.</p>
            </div>

            <div className="progress-summary">
              <h3>Today's Summary</h3>
              <p>
                {completedCount} completed out of {reminders.length}
              </p>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(completedCount / reminders.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="activity-list">
              {reminders.map((reminder) => (
                <div className="activity-row" key={reminder.id}>
                  <span>
                    {reminder.emoji} {reminder.title}
                  </span>
                  <span>
                    {completed.includes(reminder.id)
                      ? "✓ Completed"
                      : "Not completed"}
                  </span>
                </div>
              ))}
            </div>

            <button className="secondary-button" onClick={resetProgress}>
              Reset today's progress
            </button>
          </section>
        )}
      </main>

      {activeReminder && (
        <div
          role="dialog"
          aria-live="polite"
          aria-labelledby="nudge-reminder-title"
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            zIndex: 9999,
            width: "min(360px, calc(100vw - 32px))",
            boxSizing: "border-box",
            padding: "20px",
            borderRadius: "16px",
            background: "#ffffff",
            color: "#26352d",
            border: "1px solid #dce8df",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              color: "#568568",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            🌿 A little nudge
          </p>

          <h3
            id="nudge-reminder-title"
            style={{ margin: "0 0 8px", fontSize: "19px" }}
          >
            {activeReminder.title}
          </h3>

          <p style={{ margin: "0 0 18px", lineHeight: 1.5 }}>
            {activeReminder.message}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <button
              className="done-button"
              onClick={dismissReminder}
            >
              ✓ Got it!
            </button>

            <button
              className="secondary-button"
              onClick={snoozeReminder}
            >
              Remind me in 10 min
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
