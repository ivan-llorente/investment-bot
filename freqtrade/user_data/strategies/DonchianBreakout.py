"""
Donchian 20/10 breakout + EMA200 trend filter.

Replica de la estrategia Pine que vive en strategies/donchian-20-10.pine,
adaptada al interfaz IStrategy de Freqtrade. Los canales usan .shift(1)
para evaluar sobre el bar previo y evitar lookahead.

Para hyperoptear:
    docker compose run --rm freqtrade hyperopt \\
        --strategy DonchianBreakout \\
        --hyperopt-loss SharpeHyperOptLoss \\
        --timerange 20230101-20241231 \\
        --spaces buy sell protection \\
        --epochs 200
"""
from typing import Optional

import talib.abstract as ta
from freqtrade.strategy import DecimalParameter, IntParameter, IStrategy
from pandas import DataFrame


class DonchianBreakout(IStrategy):
    INTERFACE_VERSION = 3

    timeframe = "4h"
    can_short = False

    # ROI desactivado: la salida la decide el canal o el stop ATR.
    minimal_roi = {"0": 100}

    # Stop fijo amplio; el stop real lo aplica custom_stoploss con ATR.
    stoploss = -0.30
    use_custom_stoploss = True

    process_only_new_candles = True
    startup_candle_count = 250

    # Parámetros hyperoptables.
    entry_len = IntParameter(10, 40, default=20, space="buy")
    exit_len = IntParameter(5, 20, default=10, space="sell")
    ema_len = IntParameter(100, 300, default=200, space="buy")
    atr_mult = DecimalParameter(1.0, 4.0, default=2.0, decimals=1, space="protection")

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        df = dataframe
        df["upper"] = df["high"].rolling(self.entry_len.value).max().shift(1)
        df["lower"] = df["low"].rolling(self.entry_len.value).min().shift(1)
        df["exit_upper"] = df["high"].rolling(self.exit_len.value).max().shift(1)
        df["exit_lower"] = df["low"].rolling(self.exit_len.value).min().shift(1)
        df["ema"] = ta.EMA(df, timeperiod=self.ema_len.value)
        df["atr"] = ta.ATR(df, timeperiod=14)
        return df

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        df = dataframe
        long_regime = df["close"] > df["ema"]
        breakout = df["high"] > df["upper"]
        entry = long_regime & breakout
        df.loc[entry, "enter_long"] = 1
        df.loc[entry, "enter_tag"] = "donchian_break"
        return df

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:
        df = dataframe
        channel_exit = df["low"] < df["exit_lower"]
        df.loc[channel_exit, "exit_long"] = 1
        df.loc[channel_exit, "exit_tag"] = "channel_exit"
        return df

    def custom_stoploss(
        self,
        pair: str,
        trade,
        current_time,
        current_rate: float,
        current_profit: float,
        after_fill: bool,
        **kwargs,
    ) -> Optional[float]:
        """
        Stop ATR a la entrada, sin trailing en v1.

        Usa el ATR del último candle analizado. Para producción conviene
        congelar el ATR de la barra de entrada (custom_info en trade) en
        lugar de leer el ATR actual.
        """
        dataframe, _ = self.dp.get_analyzed_dataframe(pair, self.timeframe)
        if dataframe is None or len(dataframe) == 0:
            return None
        atr = dataframe["atr"].iloc[-1]
        if atr is None or atr <= 0:
            return None
        stop_dist = atr * float(self.atr_mult.value)
        stop_pct = -(stop_dist / current_rate)
        # No relajar el stop por encima del fijo de seguridad.
        return max(stop_pct, self.stoploss)
