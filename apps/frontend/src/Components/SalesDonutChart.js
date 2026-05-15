// src/components/SalesDonutChart.js
import React, { useState } from 'react';
import ReactEcharts from 'echarts-for-react';

const salesDataByMonth = {
  January: [
    { value: 47, name: 'Sale', itemStyle: { color: '#f05c44' } },
    { value: 28, name: 'Distribute', itemStyle: { color: '#444' } },
    { value: 18, name: 'Return', itemStyle: { color: '#1E90FF' } },
  ],
  February: [
    { value: 35, name: 'Sale', itemStyle: { color: '#f05c44' } },
    { value: 40, name: 'Distribute', itemStyle: { color: '#444' } },
    { value: 25, name: 'Return', itemStyle: { color: '#1E90FF' } },
  ],
  // Add more months as needed
};

const SalesDonutChart = () => {
  const [selectedMonth, setSelectedMonth] = useState('January');

  const option = {
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {d}%',
  },
  legend: {
    orient: 'horizontal',
    bottom: 0,
    left: 'center',
    data: ['Sale', 'Distribute', 'Return'],
  },
  series: [
    {
      name: 'Sales Report',
      type: 'pie',
      radius: ['60%', '80%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'inside',
        formatter: '{d}%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: [4, 10],
        color: '#000',
        fontWeight: 'bold',
        shadowColor: '#ccc',
        shadowBlur: 5,
      },
      labelLine: {
        show: false,
      },
      data: salesDataByMonth[selectedMonth],
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
          {Object.keys(salesDataByMonth).map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </select>
      </div>

      <ReactEcharts
        option={option}
        style={{ height: '300px', width: '100%' }}
      />
    </div>
  );
};

export default SalesDonutChart;
