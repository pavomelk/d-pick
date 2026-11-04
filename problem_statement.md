component is intended to incrementally parse user input attempting to predict date.
it should do so by analyzing entered consecutively entered digit or letter and eliminate possibilities of misinterpreting input 
the component should work with midEndian and littleEdian dates only but it shoudl be able to recognize possibility of year being entered as two-digit year and derive century from that
it should allow application to specify the dates range it is expected to operate (i.e from 20 September 1995 up to today) and use that information to rule out possibility of entered date being outside of allowed range
the component should use <input type=text> web element but it shoud complement existing <input type="date"> in such a way that it allows standard date picker part of <input type="date"> to be used in combination with the <input type="text">.
component should provide visual feedback about its current interpretation of user input on every text change in the <input type="text">
it should use Month names in its interpretation
component should prefer littleEndian interpretation of the date over the middleEndian

Example of the expected behaviour:
Let's say, date range rules set as follows: the uppper and lower boundary can be specified with leaving eithre of them eithre undefined or defined as 'now' which means current date. upper boundary can not be less than the lower boundary and vice versa.

Date Range set as ('1972-02-05', 'now') 

User input  Response
5           Not enough information, no suggestion
2           First digit must be month, so May...
5           "May 25..."
2           "May 25, 202..."
4           "May 25, 2024" - parsing complete, date identified

OR

2           Not enough information
5           Not enout information
5           Can not be 02-05 because the following "5" can not fall into permitted year range. So it must be "25 May ..."
2           "25 May 20..."
4           "25 May 2024" - parsing complete.
