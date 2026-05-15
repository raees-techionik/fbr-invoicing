// src/components/SalesStatisticsChart.js
import React from 'react';
import Chart from 'react-apexcharts';

const SalesStatisticsChart = () => {
  const categories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep','Oct', 'Nov', 'Dec'];

 const profitData = [
  45000, // Jan
  51000, // Feb
  55000, // Mar
  58000, // Apr
  60000, // May (peak)
  58000, // Jun
  60000, // Jul
  62000, // Aug
  59000, // Sep
   51000, // Feb
  55000, // Mar
  58000, // Apr
];

  const revenueData = [
  39000, // Jan
  37000, // Feb
  34000, // Mar
  30000, // Apr
  26000, // May (lowest)
  29000, // Jun
  32000, // Jul
  35000, // Aug
  38000, // Sep
   51000, // Feb
  55000, // Mar
  58000, // Apr
];


  // Convert revenue to negative values for downward bars
  const mirroredRevenue = revenueData.map(value => -value);

  const options = {
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%',
        borderRadius: 5,
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: {
        style: {
          fontSize: '13px',
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (val) => `Rs ${Math.abs(val / 1000)}k`,
      },
    },
    tooltip: {
      y: {
        formatter: (val) => `Rs ${Math.abs(val).toLocaleString()}`,
      },
    },
    grid: {
      strokeDashArray: 4,
    },
    colors: ['#f05c44', '#333333'],
    legend: { show: false },
  };

const series = [
  {
    name: 'Profit',
    data: [45000, 51000, 55000, 58000, 60000, 58000, 60000, 62000, 59000,51000, 55000, 88000 ],
  },
  {
    name: 'Revenue',
    data: [-39000, -37000, -34000, -30000, -26000, -29000, -32000, -35000, -38000, -38000 ,-38000, -18000],
  },
];


  return (
    <Chart
      options={options}
      series={series}
      type="bar"
      height={350}
    />
  );
};

export default SalesStatisticsChart;
