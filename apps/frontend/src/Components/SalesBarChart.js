// src/components/SalesBarChart.js
import React, { useState } from 'react';
import ReactEcharts from 'echarts-for-react';

const salesByDay = {
  January: [18000, 30000, 45000, 30000, 20000, 10000, 5000],
  February: [10000, 25000, 35000, 20000, 15000, 8000, 4000],
};

const SalesBarChart = () => {
  const [selectedMonth, setSelectedMonth] = useState('January');
  const days = [18, 20, 21, 22, 23, 24];

  const data = salesByDay[selectedMonth];

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: 'Day {b}: Rs {c}',
    },
    xAxis: {
      type: 'category',
      data: [18, 20, 21, 22, 23, 24],
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value) => {
          if (value === 0) return '{red|Rs 0}';
          return `{green|Rs ${value / 1000}k}`;
        },
        rich: {
          green: { color: '#28a745', fontWeight: 'bold' },
          red: { color: '#dc3545', fontWeight: 'bold' },
        },
      },
      splitLine: { lineStyle: { color: '#eee' } },
    },
    grid: {
      left: '10%',
      right: '5%',
      bottom: '15%',
      top: '10%',
    },
    series: [
      {
        data: data.map((val, idx) => ({
          value: val,
          itemStyle: {
            color: idx === 2 ? '#228B22' : '#E6EEF8', // Highlight 21st
          },
        })),
        type: 'bar',
        barWidth: '40%',
        label: {
          show: false,
        },
      },
    ],
  };

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Sales Report</h3>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          {Object.keys(salesByDay).map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </div>
      <ReactEcharts option={option} style={{ height: '300px', width: '100%' }} />
    </div>
  );
};

export default SalesBarChart;
