# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## PDF reports

Import PDF statements from the **Files** tab. On iOS and Android development builds, the app extracts common balance, equity, profit/loss, deposit, withdrawal, fee, dividend, and swap figures and shows them on the home screen. A PDF password is requested in-app when needed and is not saved. PDF text extraction requires a development build; Expo Go and web builds show an availability message.

The home screen groups metrics into a report-only snapshot, a historical analysis, and market comparisons. Position weights use account value when currencies are comparable; concentration and HHI are calculated from the reported positions. Historical returns use consecutive dated account-value snapshots and reported deposits/withdrawals. With aggregate cash flows only, TWR uses the Modified Dietz midpoint assumption and XIRR dates flows at the report-period midpoint. Volatility and drawdown therefore reflect report frequency, and historical VaR/CVaR are shown only with at least 20 return periods.

For USD portfolios with at least two valid account-value snapshots, market comparisons use the public FRED `SP500` price index and `DGS3MO` 3-month Treasury rate. The app requests only these fixed series identifiers and caches the result locally for 24 hours; portfolio files, amounts, report/operation dates, and instrument identifiers are never sent to FRED. The S&P 500 series starts in 2016 and excludes dividends. Coverage gaps are shown rather than estimated. Transaction exports support trade statistics, income, costs, and traded value, but do not provide historical account values; portfolio-return metrics are not inferred from transactions. Active Share, Fama–French alpha, and Brinson attribution remain unavailable without the underlying constituent/factor/sector data.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
