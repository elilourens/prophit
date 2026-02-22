/**
 * 100 Static Fake Transaction Datasets
 * Each user gets assigned one randomly on signup
 * Includes 12 months of data for long-term insights
 */

export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  timestamp?: string; // ISO 8601 format for precise timing (e.g., "2026-02-22T14:30:00Z")
}

export interface MonthlySnapshot {
  month: string; // YYYY-MM
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  topCategory: string;
}

export interface TransactionSummary {
  totalSpent: number;
  avgDaily: number;
  avgMonthly: number;
  topCategories: string[];
  monthlyIncome: number;
  savings: number;
  // Long-term data
  monthlySnapshots: MonthlySnapshot[];
  weeklyAverages: { week: number; amount: number }[];
  seasonalData: {
    winter: number; // Dec, Jan, Feb avg
    spring: number; // Mar, Apr, May avg
    summer: number; // Jun, Jul, Aug avg
    autumn: number; // Sep, Oct, Nov avg
  };
  // Trends
  spendingTrend: 'increasing' | 'decreasing' | 'stable';
  savingsRate: number; // percentage of income saved
  projectedMonthlySpend: number;
  runwayMonths: number;
  dataRangeMonths?: number; // How many months of data available (for uploaded data)
}

export interface UserDataset {
  id: number;
  transactions: Transaction[];
  summary: TransactionSummary;
}

// Dublin-based merchants and categories
const MERCHANTS = {
  Coffee: ['Starbucks', 'Costa Coffee', 'Insomnia', 'Bewleys', '3FE Coffee', 'Kaph', 'Two Boys Brew', 'Clement & Pekoe'],
  Groceries: ['Tesco', 'Dunnes Stores', 'Lidl', 'Aldi', 'SuperValu', 'Marks & Spencer', 'Centra', 'Spar', 'Fresh'],
  Dining: ['Nandos', 'Five Guys', 'Bunsen', 'The Brazen Head', 'Fade Street Social', 'Wowburger', 'Elephant & Castle', 'Boojum', 'Chipotle', 'Wagamama'],
  Transport: ['Uber', 'Bolt', 'Dublin Bus', 'Luas', 'Irish Rail', 'FreeNow', 'Leap Card Top-up', 'Circle K Fuel', 'Applegreen'],
  Shopping: ['Penneys', 'Brown Thomas', 'Arnotts', 'Amazon', 'ASOS', 'Zara', 'H&M', 'TK Maxx', 'Lifestyle Sports'],
  Subscriptions: ['Netflix', 'Spotify', 'Disney+', 'Amazon Prime', 'Gym Plus', 'Adobe', 'iCloud', 'YouTube Premium', 'Headspace'],
  Utilities: ['Electric Ireland', 'Bord Gais', 'Virgin Media', 'Three Ireland', 'Eir', 'Irish Water', 'Vodafone'],
  Entertainment: ['Cineworld', 'Odeon', 'Ticketmaster', 'Eventbrite', 'PlayStation Store', 'Steam', 'Lighthouse Cinema', 'The Stella'],
  Rent: ['AIB Rent Transfer', 'Bank Transfer - Rent', 'Landlord Payment', 'Property Management'],
  Transfer: ['Revolut Transfer', 'AIB Transfer', 'Bank Transfer', 'N26 Transfer'],
  Healthcare: ['Boots Pharmacy', 'Lloyds Pharmacy', 'VHI', 'Irish Life', 'GP Visit', 'Dental Care'],
  Education: ['Udemy', 'Coursera', 'Skillshare', 'LinkedIn Learning', 'Book Depository'],
  Income: ['Salary - Direct Deposit', 'Employer Payment', 'Payroll', 'Freelance Payment', 'Bonus Payment'],
};

// Generate dates for last 24 months (2 years for yearly comparisons)
const generateDates = (months: number = 24): string[] => {
  const dates: string[] = [];
  const today = new Date('2026-02-21');
  const daysToGenerate = months * 30;
  for (let i = 0; i < daysToGenerate; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

const DATES = generateDates(24);

// Helper to pick random item from array
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Get season multiplier (people spend more in winter/holidays)
const getSeasonMultiplier = (date: string): number => {
  const month = parseInt(date.split('-')[1]);
  if (month === 12 || month === 1) return 1.3; // Holiday spending
  if (month === 7 || month === 8) return 1.15; // Summer activities
  if (month === 2 || month === 3) return 0.9; // Post-holiday frugality
  return 1.0;
};

// Get day of week multiplier (weekends = more spending)
const getDayMultiplier = (date: string): number => {
  const day = new Date(date).getDay();
  if (day === 5) return 1.4; // Friday
  if (day === 6) return 1.3; // Saturday
  if (day === 0) return 1.1; // Sunday
  return 1.0;
};

// Generate a single dataset with specific profile
const generateDataset = (
  id: number,
  profile: {
    incomeRange: [number, number];
    savingsRange: [number, number];
    spendingStyle: 'frugal' | 'moderate' | 'spender';
    focusCategories: string[];
    trendDirection: 'improving' | 'worsening' | 'stable';
  }
): UserDataset => {
  const transactions: Transaction[] = [];
  const { incomeRange, savingsRange, spendingStyle, focusCategories, trendDirection } = profile;

  const monthlyIncome = Math.floor(Math.random() * (incomeRange[1] - incomeRange[0]) + incomeRange[0]);
  const savings = Math.floor(Math.random() * (savingsRange[1] - savingsRange[0]) + savingsRange[0]);

  // Spending multipliers based on style
  const baseMultiplier = spendingStyle === 'frugal' ? 0.55 : spendingStyle === 'moderate' ? 0.85 : 1.2;

  // Track monthly totals for snapshots
  const monthlyTotals: { [key: string]: { spent: number; income: number } } = {};

  // Generate 24 months of data for yearly comparisons
  for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
    const monthDate = new Date('2026-02-01');
    monthDate.setMonth(monthDate.getMonth() - monthOffset);
    const monthKey = monthDate.toISOString().slice(0, 7);

    // Trend adjustment (spending changes over time)
    let trendMultiplier = 1;
    if (trendDirection === 'improving') {
      trendMultiplier = 1 + (monthOffset * 0.02); // Spent more in past, less now
    } else if (trendDirection === 'worsening') {
      trendMultiplier = 1 - (monthOffset * 0.015); // Spent less in past, more now
    }

    monthlyTotals[monthKey] = { spent: 0, income: 0 };

    // Add monthly income (1st and 15th for some)
    const incomeDate1 = `${monthKey}-01`;
    const incomeVariation = 0.95 + Math.random() * 0.1;
    transactions.push({
      date: incomeDate1,
      description: pick(MERCHANTS.Income),
      amount: Math.round(monthlyIncome * incomeVariation),
      category: 'Income',
    });
    monthlyTotals[monthKey].income += monthlyIncome * incomeVariation;

    // Add rent (1st of month)
    const rentAmount = Math.floor((monthlyIncome * (0.28 + Math.random() * 0.12)) / 50) * 50;
    transactions.push({
      date: incomeDate1,
      description: pick(MERCHANTS.Rent),
      amount: -rentAmount,
      category: 'Rent',
    });
    monthlyTotals[monthKey].spent += rentAmount;

    // Add utilities (around 8th)
    const utilityDate = `${monthKey}-${String(6 + Math.floor(Math.random() * 5)).padStart(2, '0')}`;
    const utilityAmount = Math.floor(60 + Math.random() * 80);
    transactions.push({
      date: utilityDate,
      description: pick(MERCHANTS.Utilities),
      amount: -utilityAmount,
      category: 'Utilities',
    });
    monthlyTotals[monthKey].spent += utilityAmount;

    // Add subscriptions (various dates)
    const numSubs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numSubs; i++) {
      const subDay = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      const subAmount = Math.floor(5 + Math.random() * 18);
      transactions.push({
        date: `${monthKey}-${subDay}`,
        description: MERCHANTS.Subscriptions[i % MERCHANTS.Subscriptions.length],
        amount: -subAmount,
        category: 'Subscriptions',
      });
      monthlyTotals[monthKey].spent += subAmount;
    }

    // Generate daily transactions for the month
    const daysInMonth = new Date(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1]), 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${String(day).padStart(2, '0')}`;
      const seasonMult = getSeasonMultiplier(dateStr);
      const dayMult = getDayMultiplier(dateStr);
      const dailyMult = baseMultiplier * seasonMult * dayMult * trendMultiplier;

      // Coffee (varies by lifestyle)
      if (Math.random() < (spendingStyle === 'frugal' ? 0.25 : spendingStyle === 'moderate' ? 0.5 : 0.75)) {
        const coffeeAmount = Math.round((3 + Math.random() * 3.5) * dailyMult * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Coffee),
          amount: -coffeeAmount,
          category: 'Coffee',
        });
        monthlyTotals[monthKey].spent += coffeeAmount;
      }

      // Groceries (2-3 times per week)
      if (Math.random() < 0.35) {
        const groceryAmount = Math.round((25 + Math.random() * 75) * dailyMult * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Groceries),
          amount: -groceryAmount,
          category: 'Groceries',
        });
        monthlyTotals[monthKey].spent += groceryAmount;
      }

      // Dining out
      const diningChance = spendingStyle === 'frugal' ? 0.12 : spendingStyle === 'moderate' ? 0.22 : 0.38;
      if (Math.random() < diningChance * dayMult) {
        const diningAmount = Math.round((14 + Math.random() * 40) * dailyMult * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Dining),
          amount: -diningAmount,
          category: 'Dining',
        });
        monthlyTotals[monthKey].spent += diningAmount;
      }

      // Transport
      if (Math.random() < 0.4) {
        const transportAmount = Math.round((4 + Math.random() * 22) * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Transport),
          amount: -transportAmount,
          category: 'Transport',
        });
        monthlyTotals[monthKey].spent += transportAmount;
      }

      // Shopping (more on weekends and if focus category)
      const shoppingChance = focusCategories.includes('Shopping') ? 0.18 : 0.08;
      if (Math.random() < shoppingChance * dayMult) {
        const shoppingAmount = Math.round((20 + Math.random() * 120) * dailyMult * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Shopping),
          amount: -shoppingAmount,
          category: 'Shopping',
        });
        monthlyTotals[monthKey].spent += shoppingAmount;
      }

      // Entertainment (weekends mostly)
      const entertainmentChance = focusCategories.includes('Entertainment') ? 0.15 : 0.06;
      if (Math.random() < entertainmentChance * dayMult) {
        const entertainmentAmount = Math.round((12 + Math.random() * 55) * dailyMult * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Entertainment),
          amount: -entertainmentAmount,
          category: 'Entertainment',
        });
        monthlyTotals[monthKey].spent += entertainmentAmount;
      }

      // Healthcare (occasional)
      if (Math.random() < 0.03) {
        const healthAmount = Math.round((15 + Math.random() * 80) * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Healthcare),
          amount: -healthAmount,
          category: 'Healthcare',
        });
        monthlyTotals[monthKey].spent += healthAmount;
      }

      // Education/Learning (occasional)
      if (Math.random() < 0.02) {
        const eduAmount = Math.round((10 + Math.random() * 40) * 100) / 100;
        transactions.push({
          date: dateStr,
          description: pick(MERCHANTS.Education),
          amount: -eduAmount,
          category: 'Education',
        });
        monthlyTotals[monthKey].spent += eduAmount;
      }
    }

    // Add some transfers
    const numTransfers = Math.floor(Math.random() * 3);
    for (let i = 0; i < numTransfers; i++) {
      const transferDay = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
      const transferAmount = Math.floor(20 + Math.random() * 100);
      transactions.push({
        date: `${monthKey}-${transferDay}`,
        description: pick(MERCHANTS.Transfer),
        amount: -transferAmount,
        category: 'Transfer',
      });
      monthlyTotals[monthKey].spent += transferAmount;
    }
  }

  // Sort by date descending (most recent first)
  transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Calculate summary statistics (24 months = ~730 days)
  const expenses = transactions.filter(t => t.amount < 0);
  const totalSpent = Math.abs(expenses.reduce((sum, t) => sum + t.amount, 0));
  const avgDaily = totalSpent / 730;
  const avgMonthly = totalSpent / 24;

  // Category totals
  const categoryTotals: { [key: string]: number } = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount);
  });

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);

  // Monthly snapshots for charts
  const monthlySnapshots: MonthlySnapshot[] = Object.entries(monthlyTotals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => {
      // Find top category for this month
      const monthTransactions = expenses.filter(t => t.date.startsWith(month));
      const monthCatTotals: { [key: string]: number } = {};
      monthTransactions.forEach(t => {
        monthCatTotals[t.category] = (monthCatTotals[t.category] || 0) + Math.abs(t.amount);
      });
      const topCat = Object.entries(monthCatTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Groceries';

      return {
        month,
        totalSpent: Math.round(data.spent * 100) / 100,
        totalIncome: Math.round(data.income * 100) / 100,
        netSavings: Math.round((data.income - data.spent) * 100) / 100,
        topCategory: topCat,
      };
    });

  // Weekly averages (last 12 weeks)
  const weeklyAverages: { week: number; amount: number }[] = [];
  for (let week = 0; week < 12; week++) {
    const weekStart = new Date('2026-02-21');
    weekStart.setDate(weekStart.getDate() - (week * 7) - 6);
    const weekEnd = new Date('2026-02-21');
    weekEnd.setDate(weekEnd.getDate() - (week * 7));

    const weekTransactions = expenses.filter(t => {
      const d = new Date(t.date);
      return d >= weekStart && d <= weekEnd;
    });
    const weekTotal = Math.abs(weekTransactions.reduce((sum, t) => sum + t.amount, 0));
    weeklyAverages.push({ week: week + 1, amount: Math.round(weekTotal * 100) / 100 });
  }

  // Seasonal data
  const getSeasonAvg = (months: number[]): number => {
    const seasonTransactions = expenses.filter(t => {
      const month = parseInt(t.date.split('-')[1]);
      return months.includes(month);
    });
    const total = Math.abs(seasonTransactions.reduce((sum, t) => sum + t.amount, 0));
    const monthCount = months.length;
    return Math.round((total / monthCount) * 100) / 100;
  };

  const seasonalData = {
    winter: getSeasonAvg([12, 1, 2]),
    spring: getSeasonAvg([3, 4, 5]),
    summer: getSeasonAvg([6, 7, 8]),
    autumn: getSeasonAvg([9, 10, 11]),
  };

  // Determine spending trend
  const recentMonths = monthlySnapshots.slice(-3);
  const olderMonths = monthlySnapshots.slice(-6, -3);
  const recentAvg = recentMonths.reduce((sum, m) => sum + m.totalSpent, 0) / recentMonths.length;
  const olderAvg = olderMonths.length > 0 ? olderMonths.reduce((sum, m) => sum + m.totalSpent, 0) / olderMonths.length : recentAvg;

  let spendingTrend: 'increasing' | 'decreasing' | 'stable';
  if (recentAvg > olderAvg * 1.08) {
    spendingTrend = 'increasing';
  } else if (recentAvg < olderAvg * 0.92) {
    spendingTrend = 'decreasing';
  } else {
    spendingTrend = 'stable';
  }

  // Savings rate (use average monthly for rate calculation)
  const totalIncome = monthlyIncome * 24;
  const savingsRate = Math.round(((totalIncome - totalSpent) / totalIncome) * 100);

  // Projected monthly spend (weighted recent average)
  const projectedMonthlySpend = Math.round(
    (recentMonths[0]?.totalSpent * 0.5 + recentMonths[1]?.totalSpent * 0.3 + recentMonths[2]?.totalSpent * 0.2) || avgMonthly
  );

  // Runway calculation
  const runwayMonths = Math.round((savings / projectedMonthlySpend) * 10) / 10;

  return {
    id,
    transactions,
    summary: {
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgDaily: Math.round(avgDaily * 100) / 100,
      avgMonthly: Math.round(avgMonthly * 100) / 100,
      topCategories,
      monthlyIncome,
      savings,
      monthlySnapshots,
      weeklyAverages,
      seasonalData,
      spendingTrend,
      savingsRate,
      projectedMonthlySpend,
      runwayMonths,
    },
  };
};

// Profile templates for variety (creates diverse user types)
const PROFILES: Array<{
  incomeRange: [number, number];
  savingsRange: [number, number];
  spendingStyle: 'frugal' | 'moderate' | 'spender';
  focusCategories: string[];
  trendDirection: 'improving' | 'worsening' | 'stable';
}> = [
  // Frugal savers (IDs 1-15)
  { incomeRange: [2200, 2800], savingsRange: [20000, 45000], spendingStyle: 'frugal', focusCategories: ['Groceries'], trendDirection: 'improving' },
  { incomeRange: [2500, 3200], savingsRange: [25000, 50000], spendingStyle: 'frugal', focusCategories: ['Transport'], trendDirection: 'stable' },
  { incomeRange: [3000, 3800], savingsRange: [30000, 60000], spendingStyle: 'frugal', focusCategories: [], trendDirection: 'improving' },
  { incomeRange: [2800, 3500], savingsRange: [22000, 48000], spendingStyle: 'frugal', focusCategories: ['Healthcare'], trendDirection: 'stable' },
  { incomeRange: [3200, 4000], savingsRange: [35000, 65000], spendingStyle: 'frugal', focusCategories: ['Education'], trendDirection: 'improving' },

  // Moderate balanced (IDs 16-55)
  { incomeRange: [2800, 3500], savingsRange: [10000, 28000], spendingStyle: 'moderate', focusCategories: ['Coffee', 'Dining'], trendDirection: 'stable' },
  { incomeRange: [3200, 4000], savingsRange: [14000, 32000], spendingStyle: 'moderate', focusCategories: ['Shopping'], trendDirection: 'improving' },
  { incomeRange: [3500, 4500], savingsRange: [16000, 38000], spendingStyle: 'moderate', focusCategories: ['Entertainment'], trendDirection: 'worsening' },
  { incomeRange: [3000, 3800], savingsRange: [12000, 30000], spendingStyle: 'moderate', focusCategories: ['Dining', 'Entertainment'], trendDirection: 'stable' },
  { incomeRange: [3800, 4800], savingsRange: [18000, 42000], spendingStyle: 'moderate', focusCategories: [], trendDirection: 'improving' },
  { incomeRange: [4000, 5000], savingsRange: [20000, 48000], spendingStyle: 'moderate', focusCategories: ['Shopping', 'Dining'], trendDirection: 'stable' },
  { incomeRange: [4200, 5200], savingsRange: [22000, 50000], spendingStyle: 'moderate', focusCategories: ['Transport'], trendDirection: 'worsening' },
  { incomeRange: [3600, 4400], savingsRange: [15000, 35000], spendingStyle: 'moderate', focusCategories: ['Coffee'], trendDirection: 'improving' },

  // Big spenders (IDs 56-85)
  { incomeRange: [3500, 4500], savingsRange: [4000, 15000], spendingStyle: 'spender', focusCategories: ['Dining', 'Entertainment'], trendDirection: 'worsening' },
  { incomeRange: [4000, 5200], savingsRange: [6000, 18000], spendingStyle: 'spender', focusCategories: ['Shopping', 'Coffee'], trendDirection: 'stable' },
  { incomeRange: [4500, 5800], savingsRange: [8000, 22000], spendingStyle: 'spender', focusCategories: ['Entertainment', 'Shopping'], trendDirection: 'worsening' },
  { incomeRange: [5000, 6500], savingsRange: [10000, 28000], spendingStyle: 'spender', focusCategories: ['Dining'], trendDirection: 'improving' },
  { incomeRange: [3800, 4800], savingsRange: [5000, 16000], spendingStyle: 'spender', focusCategories: [], trendDirection: 'worsening' },
  { incomeRange: [5500, 7000], savingsRange: [12000, 30000], spendingStyle: 'spender', focusCategories: ['Shopping', 'Entertainment'], trendDirection: 'stable' },

  // High earners various styles (IDs 86-100)
  { incomeRange: [5500, 7000], savingsRange: [40000, 80000], spendingStyle: 'frugal', focusCategories: [], trendDirection: 'improving' },
  { incomeRange: [6000, 8000], savingsRange: [25000, 55000], spendingStyle: 'moderate', focusCategories: ['Dining', 'Shopping'], trendDirection: 'stable' },
  { incomeRange: [6500, 8500], savingsRange: [15000, 40000], spendingStyle: 'spender', focusCategories: ['Entertainment', 'Dining'], trendDirection: 'worsening' },
  { incomeRange: [5000, 6500], savingsRange: [35000, 70000], spendingStyle: 'frugal', focusCategories: ['Education'], trendDirection: 'improving' },
];

// Generate all 100 datasets
const generateAllDatasets = (): UserDataset[] => {
  const datasets: UserDataset[] = [];

  for (let i = 0; i < 100; i++) {
    const profile = PROFILES[i % PROFILES.length];
    datasets.push(generateDataset(i + 1, profile));
  }

  return datasets;
};

// Pre-generated datasets
export const FAKE_DATASETS: UserDataset[] = generateAllDatasets();

// Get a specific dataset by ID
export const getDatasetById = (id: number): UserDataset | undefined => {
  return FAKE_DATASETS.find(d => d.id === id);
};

// Get available dataset IDs (for assignment)
export const getAvailableDatasetIds = (usedIds: number[]): number[] => {
  return FAKE_DATASETS
    .map(d => d.id)
    .filter(id => !usedIds.includes(id));
};

// Get a random available dataset ID
export const getRandomAvailableDatasetId = (usedIds: number[]): number | null => {
  const available = getAvailableDatasetIds(usedIds);
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
};

export default FAKE_DATASETS;
